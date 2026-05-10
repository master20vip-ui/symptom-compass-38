import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { AppNav } from "@/components/AppNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getOrGenerateDiseasePage } from "@/lib/disease.functions";
import { Search, BookOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";

type PageRow = { id: string; slug: string; name: string; overview: string; updated_at: string };

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
  const [recent, setRecent] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const generate = useServerFn(getOrGenerateDiseasePage);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("disease_pages")
        .select("id,slug,name,overview,updated_at")
        .order("updated_at", { ascending: false })
        .limit(12);
      setRecent((data ?? []) as PageRow[]);
    })();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim() || loading) return;
    setLoading(true);
    try {
      const page = await generate({ data: { query: q.trim() } });
      navigate({ to: "/library/$slug", params: { slug: page.slug } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load article");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <section className="border-b border-border bg-gradient-to-b from-card/40 to-transparent">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full border border-border bg-card">
            <BookOpen className="size-6 text-neon" />
          </div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Disease library</h1>
          <p className="mt-2 font-serif text-sm italic text-muted-foreground">
            Search any condition for symptoms, treatments, prevention and more
          </p>
          <form onSubmit={onSubmit} className="mx-auto mt-8 flex max-w-xl gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search a disease…"
                className="h-11 pl-9 text-base"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={!q.trim() || loading} className="h-11 px-5">
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Search"}
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            Try: migraine, hypertension, strep throat, asthma…
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-4 flex items-baseline justify-between border-b border-border pb-2">
          <h2 className="font-display text-lg font-semibold">Recent articles</h2>
          <span className="text-xs text-muted-foreground">{recent.length} entries</span>
        </div>
        {recent.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No articles yet — search above to create the first entry.
          </p>
        ) : (
          <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((p) => (
              <li key={p.id} className="border-b border-border/40 py-2">
                <Link to="/library/$slug" params={{ slug: p.slug }} className="group block">
                  <h3 className="font-serif text-base text-neon underline-offset-2 group-hover:underline">
                    {p.name}
                  </h3>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {p.overview.replace(/[#*_>`-]/g, "").slice(0, 110)}
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
