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
  name: z.string().describe("Canonical disease name in Title Case"),
  description: z.string().describe("1-2 sentence plain-language definition"),
  overview: z.string().describe("2-4 paragraphs explaining what it is, who it affects, how common it is"),
  symptoms: z.string().describe("Bulleted list of typical signs and symptoms"),
  causes: z.string().describe("Bulleted list of causes / pathophysiology"),
  risk_factors: z.string().describe("Bulleted list of risk factors"),
  diagnosis: z.string().describe("How clinicians diagnose it (tests, exams)"),
  treatment: z.string().describe("Medical treatments and management options"),
  home_remedies: z.string().describe("Safe self-care steps"),
  prevention: z.string().describe("How to prevent or reduce risk (vaccines, hygiene, lifestyle)"),
  complications: z.string().describe("Possible complications if untreated"),
  prognosis: z.string().describe("Expected outcomes and recovery"),
  when_to_see_doctor: z.string().describe("Warning signs and timing for seeking care"),
});

type SourceArticle = {
  title: string;
  extract: string;
  url: string;
  sourceName: string;
};

// ---------- Wikipedia (primary — better coverage for specific conditions) ----------

type WikiSearchHit = { title: string; pageid: number };

async function searchWikipedia(query: string): Promise<WikiSearchHit | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query,
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
    extract: page.extract.slice(0, 30000),
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
    sourceName: "Wikipedia",
  };
}

// ---------- MedlinePlus (NIH) — supplemental ----------

async function fetchMedlinePlusArticle(query: string): Promise<SourceArticle | null> {
  const url = `https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&term=${encodeURIComponent(
    query,
  )}&retmax=1`;
  const res = await fetch(url, { headers: { "User-Agent": "Triage-Library/1.0" } });
  if (!res.ok) return null;
  const xml = await res.text();
  const docMatch = xml.match(/<document[^>]*>([\s\S]*?)<\/document>/);
  if (!docMatch) return null;
  const doc = docMatch[1];
  const pickContent = (name: string) => {
    const re = new RegExp(`<content\\s+name=\"${name}\"[^>]*>([\\s\\S]*?)<\\/content>`, "i");
    const m = doc.match(re);
    return m ? m[1] : "";
  };
  const rawTitle = pickContent("title");
  const rawSummary = pickContent("FullSummary") || pickContent("snippet");
  const urlAttr = docMatch[0].match(/<document[^>]*url=\"([^\"]+)\"/);
  const title = stripHtml(rawTitle);
  const summary = stripHtml(rawSummary);
  if (!title || !summary || summary.length < 80) return null;
  const topicUrl = urlAttr?.[1] ?? "https://medlineplus.gov/";
  let extract = summary;
  try {
    const pageRes = await fetch(topicUrl, { headers: { "User-Agent": "Triage-Library/1.0" } });
    if (pageRes.ok) {
      const html = await pageRes.text();
      const mainMatch =
        html.match(/<article[\s\S]*?<\/article>/i) || html.match(/<main[\s\S]*?<\/main>/i);
      const text = stripHtml(mainMatch ? mainMatch[0] : html);
      if (text.length > summary.length) extract = text;
    }
  } catch {
    /* keep summary */
  }
  return {
    title,
    extract: extract.slice(0, 15000),
    url: topicUrl,
    sourceName: "MedlinePlus (NIH)",
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

    // Pull from BOTH sources in parallel for the most comprehensive entry
    const [wiki, mlp] = await Promise.all([
      fetchWikipediaArticle(data.query),
      fetchMedlinePlusArticle(data.query),
    ]);

    const primary = wiki ?? mlp;
    if (!primary) {
      throw new Error(
        `No reliable medical source found for "${data.query}". Try a more specific medical term (e.g. "tension headache" instead of "head pain").`,
      );
    }

    const sources: SourceArticle[] = [wiki, mlp].filter((x): x is SourceArticle => !!x);
    const sourceLabel = sources.map((s) => s.sourceName).join(" + ");
    const sourceBlocks = sources
      .map(
        (s) => `--- SOURCE: ${s.sourceName} (${s.url}) ---
${s.extract}`,
      )
      .join("\n\n");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(apiKey);

    const { object } = await generateObject({
      model: gateway("google/gemini-2.5-flash"),
      schema: PageSchema,
      system:
        "You are a medical encyclopedia writer (think Wikipedia + Mayo Clinic). Produce a comprehensive, well-organized entry in plain English for a layperson, using ONLY information present in the provided SOURCES. Do not invent facts. If a section truly has no source material, write a brief honest note like 'No specific information was available in the source.' Use Markdown: short paragraphs, bullet lists, bold key terms. Be thorough — readers expect detail. Never prescribe specific medications or doses.",
      prompt: `TOPIC: ${data.query} (canonical: ${primary.title})

${sourceBlocks}

Write a complete encyclopedia entry covering ALL of these sections in depth:
- name: canonical Title Case name
- description: 1-2 sentence definition (like a dictionary entry)
- overview: 2-4 paragraphs — what it is, who it affects, epidemiology, types/variants
- symptoms: comprehensive bulleted list of all signs and symptoms mentioned
- causes: causes, pathogens, mechanisms (bulleted)
- risk_factors: who is at higher risk (bulleted)
- diagnosis: how doctors diagnose it — exams, lab tests, imaging
- treatment: medical treatments, medications classes, procedures (general only, no doses)
- home_remedies: safe self-care and supportive measures
- prevention: vaccines, hygiene, lifestyle, screening
- complications: possible complications if untreated or severe
- prognosis: typical recovery, mortality, long-term outlook
- when_to_see_doctor: warning signs and emergency symptoms`,
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
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });
