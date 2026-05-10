import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { ArrowLeft, ShieldAlert } from "lucide-react";

type Page = {
  id: string;
  slug: string;
  name: string;
  overview: string;
  causes: string;
  symptoms: string;
  home_remedies: string;
  when_to_see_doctor: string;
};

export const Route = createFileRoute("/library/$slug")({
  component: PageView,
  head: () => ({ meta: [{ title: "Library — Triage" }] }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
});

function PageView() {
  const { slug } = Route.useParams();
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("disease_pages")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      setPage((data as Page) ?? null);
      setLoading(false);
    })();
  }, [slug]);

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Link to="/library" className="mb-6 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Back to library
        </Link>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !page ? (
          <p className="text-sm text-muted-foreground">Entry not found.</p>
        ) : (
          <article className="prose-chat">
            <h1 className="font-display text-3xl font-semibold">{page.name}</h1>
            <Section title="Overview" body={page.overview} />
            <Section title="Common causes" body={page.causes} />
            <Section title="Symptoms" body={page.symptoms} />
            <Section title="Home remedies" body={page.home_remedies} />
            <Section title="When to see a doctor" body={page.when_to_see_doctor} />
            <div className="mt-8 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              Informational only — not a medical diagnosis. Consult a licensed clinician for diagnosis and treatment.
            </div>
          </article>
        )}
      </main>
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <section className="mt-6">
      <h2>{title}</h2>
      <ReactMarkdown>{body}</ReactMarkdown>
    </section>
  );
}
