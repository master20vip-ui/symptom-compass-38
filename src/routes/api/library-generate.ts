import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { generateObject } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
}

const PageSchema = z.object({
  name: z.string(), description: z.string(), overview: z.string(),
  symptoms: z.string(), causes: z.string(), risk_factors: z.string(),
  diagnosis: z.string(), treatment: z.string(), home_remedies: z.string(),
  prevention: z.string(), complications: z.string(), prognosis: z.string(),
  when_to_see_doctor: z.string(),
});

type SourceArticle = { title: string; extract: string; url: string; sourceName: string };

async function fetchWikipedia(query: string): Promise<SourceArticle | null> {
  const sUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=1`;
  const sres = await fetch(sUrl, { headers: { "User-Agent": "Triage/1.0" } });
  if (!sres.ok) return null;
  const sjson = (await sres.json()) as { query?: { search?: { title: string }[] } };
  const hit = sjson.query?.search?.[0];
  if (!hit) return null;
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=plain&titles=${encodeURIComponent(hit.title)}&format=json&origin=*&redirects=1`;
  const res = await fetch(url, { headers: { "User-Agent": "Triage/1.0" } });
  if (!res.ok) return null;
  const json = (await res.json()) as { query?: { pages?: Record<string, { title: string; extract?: string; missing?: boolean }> } };
  const page = Object.values(json.query?.pages ?? {})[0];
  if (!page || page.missing || !page.extract) return null;
  return {
    title: page.title,
    extract: page.extract.slice(0, 30000),
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
    sourceName: "Wikipedia",
  };
}

async function fetchMedlinePlus(query: string): Promise<SourceArticle | null> {
  const url = `https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&term=${encodeURIComponent(query)}&retmax=1`;
  const res = await fetch(url, { headers: { "User-Agent": "Triage/1.0" } });
  if (!res.ok) return null;
  const xml = await res.text();
  const docMatch = xml.match(/<document[^>]*>([\s\S]*?)<\/document>/);
  if (!docMatch) return null;
  const doc = docMatch[1];
  const pick = (name: string) => {
    const m = doc.match(new RegExp(`<content\\s+name="${name}"[^>]*>([\\s\\S]*?)<\\/content>`, "i"));
    return m ? stripHtml(m[1]) : "";
  };
  const title = pick("title");
  const summary = pick("FullSummary") || pick("snippet");
  if (!title || !summary || summary.length < 80) return null;
  const urlAttr = docMatch[0].match(/<document[^>]*url="([^"]+)"/);
  return {
    title,
    extract: summary.slice(0, 15000),
    url: urlAttr?.[1] ?? "https://medlineplus.gov/",
    sourceName: "MedlinePlus (NIH)",
  };
}

export const Route = createFileRoute("/api/library-generate")({
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

          const body = await request.json();
          const { query } = z.object({ query: z.string().min(2).max(120) }).parse(body);
          const slug = slugify(query);
          if (!slug) return new Response("Invalid query", { status: 400 });

          const { data: existing } = await supabase
            .from("disease_pages").select("*").eq("slug", slug).maybeSingle();
          if (existing) return Response.json(existing);

          const [wiki, mlp] = await Promise.all([fetchWikipedia(query), fetchMedlinePlus(query)]);
          const primary = wiki ?? mlp;
          if (!primary) {
            return Response.json(
              { error: `No reliable medical source found for "${query}". Try a more specific medical term.` },
              { status: 404 },
            );
          }
          const sources = [wiki, mlp].filter((x): x is SourceArticle => !!x);
          const sourceLabel = sources.map((s) => s.sourceName).join(" + ");
          const sourceBlocks = sources.map((s) => `--- SOURCE: ${s.sourceName} (${s.url}) ---\n${s.extract}`).join("\n\n");

          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
          const gateway = createLovableAiGatewayProvider(apiKey);

          const { object } = await generateObject({
            model: gateway("google/gemini-2.5-flash"),
            schema: PageSchema,
            system:
              "You are a medical encyclopedia writer. Produce a comprehensive, plain-English entry using ONLY the provided SOURCES. Do not invent facts. If a section has no source material, write a brief honest note. Use Markdown with short paragraphs and bullet lists. Never prescribe specific medications or doses.",
            prompt: `TOPIC: ${query} (canonical: ${primary.title})\n\n${sourceBlocks}\n\nWrite a complete entry covering: name, description (1-2 sentences), overview (2-4 paragraphs), symptoms, causes, risk_factors, diagnosis, treatment, home_remedies, prevention, complications, prognosis, when_to_see_doctor.`,
          });

          const { data: inserted, error } = await supabase
            .from("disease_pages")
            .insert({
              slug,
              name: object.name || primary.title,
              description: object.description,
              overview: object.overview,
              symptoms: object.symptoms,
              causes: object.causes,
              risk_factors: object.risk_factors,
              diagnosis: object.diagnosis,
              treatment: object.treatment,
              home_remedies: object.home_remedies,
              prevention: object.prevention,
              complications: object.complications,
              prognosis: object.prognosis,
              when_to_see_doctor: object.when_to_see_doctor,
              source_url: primary.url,
              source_name: sourceLabel,
              created_by: userId,
            })
            .select().single();
          if (error) return Response.json({ error: error.message }, { status: 500 });
          return Response.json(inserted);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Server error";
          console.error("[library-generate]", err);
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
