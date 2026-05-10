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

type WikiSearchHit = { title: string; pageid: number };

async function searchWikipedia(query: string): Promise<WikiSearchHit | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query + " (medical condition OR disease OR symptom)",
  )}&format=json&origin=*&srlimit=1`;
  const res = await fetch(url, { headers: { "User-Agent": "Triage-Library/1.0" } });
  if (!res.ok) return null;
  const json = (await res.json()) as { query?: { search?: WikiSearchHit[] } };
  return json.query?.search?.[0] ?? null;
}

async function fetchWikipediaExtract(title: string): Promise<{ extract: string; url: string } | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=plain&titles=${encodeURIComponent(
    title,
  )}&format=json&origin=*&redirects=1`;
  const res = await fetch(url, { headers: { "User-Agent": "Triage-Library/1.0" } });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    query?: { pages?: Record<string, { title: string; extract?: string; missing?: boolean }> };
  };
  const pages = json.query?.pages ?? {};
  const page = Object.values(pages)[0];
  if (!page || page.missing || !page.extract) return null;
  return {
    extract: page.extract.slice(0, 12000),
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
  };
}

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

    // 1. Find a real Wikipedia article for this query
    const hit = await searchWikipedia(data.query);
    if (!hit) {
      throw new Error(
        `No reliable medical source found for "${data.query}". Try a more specific medical term (e.g. "tension headache" instead of "head pain").`,
      );
    }
    const article = await fetchWikipediaExtract(hit.title);
    if (!article) {
      throw new Error(`Could not load source content for "${hit.title}".`);
    }

    // 2. Use Lovable AI to restructure the source content into encyclopedia sections
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(apiKey);

    const { object } = await generateObject({
      model: gateway("google/gemini-2.5-flash"),
      schema: PageSchema,
      system:
        "You are a medical writer. Rewrite source material into a plain-language encyclopedia entry for laypeople. Avoid jargon. Use only information present in the SOURCE. Do not invent facts. If a section has no source material, say so briefly. Format each section as Markdown with bullet points where appropriate. Never prescribe specific medications or doses.",
      prompt: `TOPIC: ${hit.title}

SOURCE (from Wikipedia, treat as ground truth):
"""
${article.extract}
"""

Produce an encyclopedia entry with these sections, in plain English, derived from the SOURCE only:
- name: canonical name (Title Case, taken from TOPIC)
- overview: 2-3 short paragraphs describing what this is
- causes: bulleted list of common causes / risk factors
- symptoms: bulleted list of typical symptoms / signs
- home_remedies: bulleted list of safe self-care steps mentioned in the source (skip prescription treatments)
- when_to_see_doctor: bulleted list of warning signs and timing guidance for seeking care`,
    });

    const { data: inserted, error } = await supabase
      .from("disease_pages")
      .insert({
        slug,
        name: object.name || hit.title,
        overview: object.overview,
        causes: object.causes,
        symptoms: object.symptoms,
        home_remedies: object.home_remedies,
        when_to_see_doctor: object.when_to_see_doctor,
        source_url: article.url,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });
