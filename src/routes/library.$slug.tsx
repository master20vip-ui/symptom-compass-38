import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { ArrowLeft, ExternalLink, ShieldAlert, Clock } from "lucide-react";

type Page = {
  id: string;
  slug: string;
  name: string;
  overview: string;
  causes: string;
  symptoms: string;
  home_remedies: string;
  when_to_see_doctor: string;
  source_url: string | null;
  source_name: string | null;
  updated_at: string;
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

const SECTIONS = [
  { id: "overview", title: "Overview", key: "overview" as const },
  { id: "causes", title: "Causes", key: "causes" as const },
  { id: "symptoms", title: "Signs and symptoms", key: "symptoms" as const },
  { id: "remedies", title: "Home care", key: "home_remedies" as const },
  { id: "doctor", title: "When to see a doctor", key: "when_to_see_doctor" as const },
];

function PageView() {
  const { slug } = Route.useParams();
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("disease_pages")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      setPage((data as Page) ?? null);
      setLoading(false);
    })();
  }, [slug]);

  const updated = useMemo(
    () => (page ? new Date(page.updated_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : ""),
    [page],
  );

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Link
          to="/library"
          className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to library
        </Link>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading article…</p>
        ) : !page ? (
          <p className="text-sm text-muted-foreground">Entry not found.</p>
        ) : (
          <article className="wiki-article">
            {/* Title block */}
            <header className="border-b border-border pb-3">
              <h1 className="font-serif text-4xl font-normal leading-tight">{page.name}</h1>
              <p className="mt-1 font-serif text-sm italic text-muted-foreground">
                From the Triage Disease Library, the free medical encyclopedia
              </p>
            </header>

            <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_260px]">
              {/* Body */}
              <div className="min-w-0 order-2 lg:order-1">
                {/* Table of contents */}
                <nav className="mb-6 inline-block rounded-md border border-border bg-card/40 p-4 text-sm">
                  <div className="mb-2 font-serif text-xs uppercase tracking-wider text-muted-foreground">
                    Contents
                  </div>
                  <ol className="list-decimal space-y-1 pl-5">
                    {SECTIONS.map((s, i) => (
                      <li key={s.id}>
                        <a href={`#${s.id}`} className="text-neon hover:underline">
                          {i + 1} {s.title}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>

                {SECTIONS.map((s) => (
                  <Section key={s.id} id={s.id} title={s.title} body={page[s.key]} />
                ))}

                <div className="mt-10 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                  Informational only — not a medical diagnosis. Consult a licensed clinician for diagnosis and treatment.
                </div>
              </div>

              {/* Infobox sidebar */}
              <aside className="order-1 lg:order-2">
                <div className="rounded-md border border-border bg-card/60 p-4 text-sm shadow-sm lg:sticky lg:top-4">
                  <div className="border-b border-border pb-2 text-center font-serif text-base font-semibold">
                    {page.name}
                  </div>
                  <dl className="mt-3 space-y-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Type</dt>
                      <dd className="font-serif">Medical condition</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Last updated</dt>
                      <dd className="inline-flex items-center gap-1 font-serif">
                        <Clock className="size-3" /> {updated}
                      </dd>
                    </div>
                    {page.source_url && (
                      <div>
                        <dt className="text-muted-foreground">Source</dt>
                        <dd>
                          <a
                            href={page.source_url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 break-all text-neon hover:underline"
                          >
                            <ExternalLink className="size-3 shrink-0" />
                            {new URL(page.source_url).hostname}
                          </a>
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </aside>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}

function Section({ id, title, body }: { id: string; title: string; body: string }) {
  return (
    <section id={id} className="mt-8 scroll-mt-20">
      <h2 className="border-b border-border pb-1 font-serif text-2xl font-normal">{title}</h2>
      <div className="prose-chat mt-3 font-serif text-[15px] leading-relaxed">
        <ReactMarkdown>{body}</ReactMarkdown>
      </div>
    </section>
  );
}
