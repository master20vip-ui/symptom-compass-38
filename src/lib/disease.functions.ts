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

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const PageSchema = z.object({
  name: z.string(),
  overview: z.string(),
  causes: z.string(),
  symptoms: z.string(),
  home_remedies: z.string(),
  when_to_see_doctor: z.string(),
});

type SourceArticle = { title: string; extract: string; url: string; sourceName: string };

// ---------- MedlinePlus (NIH) ----------

async function searchMedlinePlus(query: string): Promise<SourceArticle | null> {
  const url = `https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&term=${encodeURIComponent(
    query,
  )}&retmax=1`;
  const res = await fetch(url, { headers: { "User-Agent": "Triage-Library/1.0" } });
  if (!res.ok) return null;
  const xml = await res.text();

  // Extract first <document>...</document>
  const docMatch = xml.match(/<document[^>]*>([\s\S]*?)<\/document>/);
  if (!docMatch) return null;
  const doc = docMatch[1];

  const pickContent = (name: string) => {
    const re = new RegExp(
      `<content\\s+name=\"${name}\"[^>]*>([\\s\\S]*?)<\\/content>`,
      "i",
    );
    const m = doc.match(re);
    return m ? m[1] : "";
  };

  const rawTitle = pickContent("title");
  const rawSummary = pickContent("FullSummary") || pickContent("snippet");
  const urlAttr = docMatch[0].match(/<document[^>]*url=\"([^\"]+)\"/);

  const title = stripHtml(rawTitle);
  const summary = stripHtml(rawSummary);
  if (!title || !summary || summary.length < 80) return null;

  const topicUrl = urlAttr?.[1] ?? `https://medlineplus.gov/`;

  // Try to enrich with the full topic page text
  let extract = summary;
  try {
    const pageRes = await fetch(topicUrl, {
      headers: { "User-Agent": "Triage-Library/1.0" },
    });
    if (pageRes.ok) {
      const html = await pageRes.text();
      // Grab the main content area if possible
      const mainMatch =
        html.match(/<article[\s\S]*?<\/article>/i) ||
        html.match(/<main[\s\S]*?<\/main>/i);
      const text = stripHtml(mainMatch ? mainMatch[0] : html);
      if (text.length > summary.length) extract = text;
    }
  } catch {
    // fall back to summary
  }

  return {
    title,
    extract: extract.slice(0, 12000),
    url: topicUrl,
    sourceName: "MedlinePlus (NIH)",
  };
}

// ---------- Wikipedia (fallback) ----------

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

async function fetchWikipediaArticle(query: string): Promise<SourceArticle | null> {
  const hit = await searchWikipedia(query);
  if (!hit) return null;
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=plain&titles=${encodeURIComponent(
    hit.title,
  )}&format=json&origin=*&redirects=1`;
  const res = await fetch(url, { headers: { "User-Agent": "Triage-Library/1.0" } });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    query?: { pages?: Record<string, { title: string; extract?: string; missing?: boolean }> };
  };
  const page = Object.values(json.query?.pages ?? {})[0];
  if (!page || page.missing || !page.extract) return null;
  return {
    title: page.title,
    extract: page.extract.slice(0, 12000),
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
    sourceName: "Wikipedia",
  };
}

// ---------- Main server function ----------

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

    // 1. Try MedlinePlus first, then Wikipedia
    let article = await searchMedlinePlus(data.query);
    if (!article) {
      article = await fetchWikipediaArticle(data.query);
    }
    if (!article) {
      throw new Error(
        `No reliable medical source found for "${data.query}". Try a more specific medical term (e.g. "tension headache" instead of "head pain").`,
      );
    }

    // 2. Use Lovable AI to restructure the source into encyclopedia sections
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(apiKey);

    const { object } = await generateObject({
      model: gateway("google/gemini-2.5-flash"),
      schema: PageSchema,
      system:
        "You are a medical writer. Rewrite source material into a plain-language encyclopedia entry for laypeople. Avoid jargon. Use only information present in the SOURCE. Do not invent facts. If a section has no source material, say so briefly. Format each section as Markdown with bullet points where appropriate. Never prescribe specific medications or doses.",
      prompt: `TOPIC: ${article.title}
SOURCE NAME: ${article.sourceName}

SOURCE (treat as ground truth):
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
        name: object.name || article.title,
        overview: object.overview,
        causes: object.causes,
        symptoms: object.symptoms,
        home_remedies: object.home_remedies,
        when_to_see_doctor: object.when_to_see_doctor,
        source_url: article.url,
        source_name: article.sourceName,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });
