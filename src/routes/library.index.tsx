import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { AppNav } from "@/components/AppNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getOrGenerateDiseasePage } from "@/lib/disease.functions";
import { Search, BookOpen, Sparkles } from "lucide-react";
import { toast } from "sonner";

type PageRow = {
  id: string;
  slug: string;
  name: string;
  overview: string;
  updated_at: string;
};

export const Route = createFileRoute("/library/")({
  component: LibraryPage,
  head: () => ({ meta: [{ title: "Disease library — Triage" }] }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
});

function LibraryPage() {
  const [q, setQ] = useState("");
  const [pages, setPages] = useState<PageRow[]>([]);
  const [generating, setGenerating] = useState(false);
  const navigate = useNavigate();
  const generate = useServerFn(getOrGenerateDiseasePage);

  const load = async (term: string) => {
    let query = supabase.from("disease_pages").select("id,slug,name,overview,updated_at").order("updated_at", { ascending: false }).limit(30);
    if (term.trim()) query = query.ilike("name", `%${term.trim()}%`);
    const { data, error } = await query;
    if (error) toast.error("Could not load library");
    else setPages((data ?? []) as PageRow[]);
  };

  useEffect(() => {
    load("");
  }, []);

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await load(q);
  };

  const onGenerate = async () => {
    if (!q.trim()) return;
    setGenerating(true);
    try {
      const page = await generate({ data: { query: q.trim() } });
      navigate({ to: "/library/$slug", params: { slug: page.slug } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate page");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold">Disease library</h1>
          <p className="text-sm text-muted-foreground">
            Search conditions in plain language. If a topic isn't here yet, generate a new entry.
          </p>
        </div>

        <form onSubmit={onSearch} className="mb-6 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search e.g. migraine, hypertension, strep throat…"
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">Search</Button>
          <Button type="button" onClick={onGenerate} disabled={!q.trim() || generating} className="glow-neon">
            <Sparkles className="mr-1 size-4" />
            {generating ? "Generating…" : "Generate"}
          </Button>
        </form>

        {pages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No entries match. Type a condition above and tap <span className="text-neon">Generate</span> to create one.
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {pages.map((p) => (
              <li key={p.id}>
                <Link
                  to="/library/$slug"
                  params={{ slug: p.slug }}
                  className="block rounded-2xl border border-border bg-card/40 p-4 transition hover:border-neon/50 hover:bg-card/60"
                >
                  <div className="mb-1 flex items-center gap-2 text-xs text-neon">
                    <BookOpen className="size-3.5" /> Encyclopedia
                  </div>
                  <h3 className="font-display text-base font-semibold">{p.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {p.overview.replace(/[#*_>`-]/g, "").slice(0, 160)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
