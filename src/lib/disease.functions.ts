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
  description: z.string(),
  overview: z.string(),
  symptoms: z.string(),
  causes: z.string(),
  risk_factors: z.string(),
  diagnosis: z.string(),
  treatment: z.string(),
  home_remedies: z.string(),
  prevention: z.string(),
  complications: z.string(),
  prognosis: z.string(),
  when_to_see_doctor: z.string(),
});

type SourceArticle = { title: string; extract: string; url: string; sourceName: string };

async function fetchWikipediaArticle(query: string): Promise<SourceArticle | null> {
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query,
  )}&format=json&origin=*&srlimit=1`;
  const sres = await fetch(searchUrl, { headers: { "User-Agent": "Triage-Library/1.0" } });
  if (!sres.ok) return null;
  const sjson = (await sres.json()) as { query?: { search?: { title: string }[] } };
  const hit = sjson.query?.search?.[0];
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

async function fetchMedlinePlusArticle(query: string): Promise<SourceArticle | null> {
  const url = `https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&term=${encodeURIComponent(query)}&retmax=1`;
  const res = await fetch(url, { headers: { "User-Agent": "Triage-Library/1.0" } });
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

    const [wiki, mlp] = await Promise.all([
      fetchWikipediaArticle(data.query),
      fetchMedlinePlusArticle(data.query),
    ]);
    const primary = wiki ?? mlp;
    if (!primary) {
      throw new Error(
        `No reliable medical source found for "${data.query}". Try a more specific medical term.`,
      );
    }
    const sources = [wiki, mlp].filter((x): x is SourceArticle => !!x);
    const sourceLabel = sources.map((s) => s.sourceName).join(" + ");
    const sourceBlocks = sources
      .map((s) => `--- SOURCE: ${s.sourceName} (${s.url}) ---\n${s.extract}`)
      .join("\n\n");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(apiKey);

    const { object } = await generateObject({
      model: gateway("google/gemini-2.5-flash"),
      schema: PageSchema,
      system:
        "You are a medical encyclopedia writer. Produce a comprehensive, plain-English entry using ONLY the provided SOURCES. Do not invent facts. If a section has no source material, write a brief honest note. Use Markdown with short paragraphs and bullet lists. Never prescribe specific medications or doses.",
      prompt: `TOPIC: ${data.query} (canonical: ${primary.title})\n\n${sourceBlocks}\n\nWrite a complete entry covering: name, description (1-2 sentences), overview (2-4 paragraphs), symptoms, causes, risk_factors, diagnosis, treatment, home_remedies, prevention, complications, prognosis, when_to_see_doctor.`,
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
