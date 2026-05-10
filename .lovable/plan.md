
# Real Medical Data for the Disease Library

Currently, library entries are generated only from Wikipedia. We'll layer in **MedlinePlus** (the U.S. National Library of Medicine's free consumer-health API) as the primary source, with Wikipedia as fallback. Both are free, key-less, and CORS/server-friendly.

## Data sources

1. **MedlinePlus Connect / Web Service** (primary)
   - Endpoint: `https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&term=<query>&rettype=brief`
   - Returns ranked health topics with title, summary HTML, and a canonical `medlineplus.gov` URL.
   - For the top hit, we also fetch the full topic page text via the topic URL (server-side fetch + strip HTML) to give the AI richer source material.
2. **Wikipedia** (fallback)
   - Existing logic already in `src/lib/disease.functions.ts` is kept as-is.
3. **Not found**
   - If MedlinePlus returns 0 hits **and** Wikipedia returns 0 hits, throw a clear error: *"No reliable medical source found for '<term>'. Try a more specific medical term."*
   - The library page already toasts this message — no UI change needed.

## What changes

### `src/lib/disease.functions.ts`
- Add `searchMedlinePlus(query)` — calls the NLM wsearch API, parses the XML/JSON response, returns `{ title, summary, url } | null`.
- Add `fetchMedlinePlusArticle(url)` — fetches the topic page HTML, strips tags, returns up to ~12k chars of plain text.
- Update `getOrGenerateDiseasePage`:
  1. Try MedlinePlus first. If hit, use it as the AI's SOURCE and store its URL in `source_url`.
  2. If MedlinePlus misses, fall back to existing Wikipedia path.
  3. If both miss, throw the not-found error (no AI generation, no DB insert).
- Pass a `source_name` ("MedlinePlus (NIH)" or "Wikipedia") into the AI prompt and persist it so the article header can display it.

### `src/routes/library.$slug.tsx` (small UI tweak)
- In the infobox sidebar, show the source label (e.g. "MedlinePlus (NIH)") next to the source link, so readers know where the content came from.
- No layout changes.

### Database
- Add a nullable `source_name TEXT` column to `disease_pages` so we can label each entry's origin. Existing rows stay valid.

## Out of scope
- No new connectors, no API keys, no scraping of Mayo/WebMD.
- No changes to chat, dashboard, auth, or styling system.
- Existing entries already in the DB are not re-fetched; they keep their current `source_url` and just won't show a source label until regenerated.

## Technical notes
- MedlinePlus wsearch returns XML by default; we'll request and parse it with a small regex/`fast-xml-parser`-free approach (string extraction of `<content name="title">` and `<content name="FullSummary">`), to avoid adding dependencies.
- All network calls remain inside the `createServerFn` handler (server-only).
- Error messages thrown from the server function already surface as toasts on the library search page.
