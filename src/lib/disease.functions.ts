import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { generateObject } from "ai";

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const PageSchema = z.object({
  name: z.string(),
  overview: z.string(),
  causes: z.string(),
  symptoms: z.string(),
  home_remedies: z.string(),
  when_to_see_doctor: z.string(),
});

export const getOrGenerateDiseasePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { query: string }) =>
    z.object({ query: z.string().min(2).max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const slug = slugify(data.query);
    if (!slug) throw new Error("Invalid query");

    const { data: existing } = await supabase
      .from("disease_pages")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (existing) return existing;

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(apiKey);

    const { object } = await generateObject({
      model: gateway("google/gemini-2.5-flash"),
      schema: PageSchema,
      system:
        "You are a medical writer producing plain-language encyclopedia entries for laypeople. Avoid jargon. Each section should be 2-5 short paragraphs or bullet points formatted as Markdown. Never prescribe medications or doses. Always remind readers this is informational, not a diagnosis.",
      prompt: `Write an encyclopedia entry for the medical condition or topic: "${data.query}". Use plain English.

Sections required:
- name: the canonical condition name (Title Case)
- overview: 2-3 short paragraphs
- causes: bulleted list of common causes
- symptoms: bulleted list of typical symptoms
- home_remedies: bulleted list of safe self-care steps
- when_to_see_doctor: bulleted list of warning signs and timing guidance

If the query is not a recognizable medical topic, return a name explaining it is not a medical topic and short content saying so.`,
    });

    const { data: inserted, error } = await supabase
      .from("disease_pages")
      .insert({
        slug,
        name: object.name,
        overview: object.overview,
        causes: object.causes,
        symptoms: object.symptoms,
        home_remedies: object.home_remedies,
        when_to_see_doctor: object.when_to_see_doctor,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });
