import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `You are Triage, an AI symptom-intake assistant. Your role:

1. Conduct a focused, conversational symptom intake. Ask ONE question at a time. Start broad ("What is your main symptom?") then narrow (duration, severity, location, triggers, associated symptoms, medications, relevant history).

2. After gathering enough context (typically 4-8 targeted questions), produce a "Probability Assessment" as a markdown section with this exact structure:

## Probability Assessment

- **Condition A** — XX% — short rationale
- **Condition B** — XX% — short rationale
- **Condition C** — XX% — short rationale

## Recommended Next Steps

1. Self-care actions
2. When to see a primary care provider (timeframe)
3. Warning signs to watch for

## Disclaimer

> This is informational only — not a medical diagnosis. Probabilities reflect pattern-matching against your reported symptoms, not a clinical evaluation. Consult a licensed clinician for diagnosis and treatment.

3. RED FLAG PROTOCOL — if the user mentions any of: chest pain, crushing chest pressure, shortness of breath at rest, sudden severe headache, slurred speech, facial droop, one-sided weakness, loss of consciousness, severe abdominal pain, uncontrolled bleeding, suicidal ideation, anaphylaxis, severe allergic reaction, stiff neck with fever, infant under 3 months with fever — IMMEDIATELY skip questions and respond with:

## 🚨 Seek Emergency Care Now

**Stop using this app and call emergency services (911 / 112 / your local emergency number) or go to the nearest emergency room immediately.**

Then briefly state which symptom triggered the alert.

4. Tone: warm, calm, clinical. Never speculate beyond reasonable probabilities. Never prescribe medications or doses.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization");
          const token = auth?.replace(/^Bearer\s+/i, "");
          if (!token) return new Response("Unauthorized", { status: 401 });

          const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            {
              global: { headers: { Authorization: `Bearer ${token}` } },
              auth: { persistSession: false, autoRefreshToken: false },
            },
          );
          const { data: userData, error: userErr } = await supabase.auth.getUser(token);
          if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
          const userId = userData.user.id;

          const body = (await request.json()) as {
            messages: UIMessage[];
            threadId: string;
            activeProfileId?: string | null;
          };
          const { messages, threadId, activeProfileId } = body;
          if (!threadId || !Array.isArray(messages)) {
            return new Response("Bad request", { status: 400 });
          }

          // Verify thread ownership
          const { data: thread } = await supabase
            .from("threads")
            .select("id, title")
            .eq("id", threadId)
            .maybeSingle();
          if (!thread) return new Response("Thread not found", { status: 404 });

          // Build profile + meds + symptom history context
          let contextBlock = "";
          if (activeProfileId) {
            const [{ data: profile }, { data: meds }, { data: symptoms }] = await Promise.all([
              supabase.from("profiles_dependents").select("*").eq("id", activeProfileId).maybeSingle(),
              supabase.from("medications").select("*").eq("profile_id", activeProfileId).is("ended_on", null),
              supabase
                .from("symptom_logs")
                .select("symptom, severity, logged_at")
                .eq("profile_id", activeProfileId)
                .gte("logged_at", new Date(Date.now() - 30 * 86400000).toISOString())
                .order("logged_at", { ascending: true }),
            ]);

            const lines: string[] = [];
            if (profile) {
              const dob = profile.date_of_birth ? new Date(profile.date_of_birth) : null;
              let age: number | null = null;
              if (dob) {
                const now = new Date();
                age = now.getFullYear() - dob.getFullYear();
                const m = now.getMonth() - dob.getMonth();
                if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
              }
              lines.push(`ACTIVE PROFILE: ${profile.name} — ${profile.relation}, ${profile.sex}${age != null ? `, ${age} years old` : ""}${profile.notes ? ` (notes: ${profile.notes})` : ""}`);
            }
            if (meds && meds.length > 0) {
              lines.push("\nCURRENT MEDICATIONS:");
              for (const m of meds) {
                const se = (m.common_side_effects ?? []).join(", ");
                lines.push(`  - ${m.name}${m.dosage ? ` ${m.dosage}` : ""}${m.frequency ? ` ${m.frequency}` : ""} (${m.kind}${m.started_on ? `, since ${m.started_on}` : ""})${se ? ` — known side effects: ${se}` : ""}`);
              }
            }
            if (symptoms && symptoms.length > 0) {
              const bySymptom = new Map<string, { severity: number; logged_at: string }[]>();
              for (const s of symptoms) {
                const arr = bySymptom.get(s.symptom) ?? [];
                arr.push({ severity: s.severity, logged_at: s.logged_at });
                bySymptom.set(s.symptom, arr);
              }
              lines.push("\nRECENT SYMPTOM HISTORY (last 30 days):");
              for (const [name, arr] of bySymptom) {
                const first = new Date(arr[0].logged_at);
                const last = new Date(arr[arr.length - 1].logged_at);
                const days = Math.max(1, Math.floor((last.getTime() - first.getTime()) / 86400000) + 1);
                const trend = arr[arr.length - 1].severity - arr[0].severity;
                const trendStr = trend > 0 ? "worsening" : trend < 0 ? "improving" : "stable";
                lines.push(`  - ${name}: ${arr.length} entries over ${days} day(s), ${trendStr} (severity ${arr[0].severity} → ${arr[arr.length - 1].severity})`);
              }
            }

            if (lines.length > 0) {
              contextBlock = `\n\n---\nUSER CONTEXT (use this to personalize triage):\n${lines.join("\n")}\n\nIMPORTANT INTEGRATION RULES:\n- Before suggesting a new condition, check if reported symptoms match listed medication side effects and surface that possibility first.\n- If a reported symptom appears in the recent history with duration ≥ 7 days OR a worsening trend, escalate the triage recommendation one level.\n- Tailor probabilities and red flags to the active profile's age and sex (e.g. fever in infants under 3 months is always a red flag).\n---`;
            }
          }


          // Persist the latest user message
          const lastMsg = messages[messages.length - 1];
          if (lastMsg?.role === "user") {
            await supabase.from("messages").insert({
              thread_id: threadId,
              user_id: userId,
              role: "user",
              parts: lastMsg.parts as never,
            });

            // Auto-title from first user message
            if (thread.title === "New symptom check") {
              const text = lastMsg.parts
                .map((p) => (p.type === "text" ? p.text : ""))
                .join(" ")
                .slice(0, 60);
              if (text.trim()) {
                await supabase
                  .from("threads")
                  .update({ title: text, updated_at: new Date().toISOString() })
                  .eq("id", threadId);
              }
            } else {
              await supabase
                .from("threads")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", threadId);
            }
          }

          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

          const gateway = createLovableAiGatewayProvider(apiKey);
          const model = gateway("google/gemini-3-flash-preview");

          const result = streamText({
            model,
            system: SYSTEM_PROMPT + contextBlock,
            messages: await convertToModelMessages(messages),
          });

          return result.toUIMessageStreamResponse({
            originalMessages: messages,
            onFinish: async ({ messages: finalMessages }) => {
              const assistant = finalMessages[finalMessages.length - 1];
              if (assistant?.role === "assistant") {
                await supabase.from("messages").insert({
                  thread_id: threadId,
                  user_id: userId,
                  role: "assistant",
                  parts: assistant.parts as never,
                });
              }
            },
          });
        } catch (err) {
          console.error("[/api/chat] error", err);
          return new Response("Server error", { status: 500 });
        }
      },
    },
  },
});
