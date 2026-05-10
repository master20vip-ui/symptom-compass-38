import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ArrowRight, Activity, ShieldAlert, Sparkle, Stethoscope } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Symptom Compass — AI symptom checker" },
      {
        name: "description",
        content:
          "Conversational AI symptom intake with weighted probability assessments and red-flag emergency triage. Information, not diagnosis.",
      },
    ],
  }),
});

function Landing() {
  const navigate = useNavigate();
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
  }, []);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <nav className="flex items-center gap-3">
          {hasSession ? (
            <Button onClick={() => navigate({ to: "/app" })} variant="default">
              Open app
            </Button>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Sign in
              </Link>
              <Button onClick={() => navigate({ to: "/login" })} variant="default">
                Get started
              </Button>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-12">
        <section className="relative overflow-hidden rounded-3xl border border-border bg-card/40 px-8 py-20 backdrop-blur md:px-16 md:py-28">
          <div className="absolute inset-0 bg-grid opacity-30" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/50 px-3 py-1 text-xs text-muted-foreground">
              <Sparkle className="size-3 text-neon" /> AI-powered symptom intake
            </div>
            <h1 className="mt-6 max-w-3xl font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
              Understand your symptoms<br />
              <span className="text-neon">before</span> you book the appointment.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              Symptom Compass walks you through a conversational intake, then returns a
              weighted probability of likely conditions and clear next steps —
              with built-in red-flag detection for emergencies.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                onClick={() => navigate({ to: hasSession ? "/app" : "/login" })}
                className="glow-neon"
              >
                Start a symptom check <ArrowRight className="ml-1 size-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                Information, not a medical diagnosis.
              </span>
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Stethoscope,
              title: "Conversational intake",
              body: "One question at a time, narrowing down from your main symptom — like a focused triage nurse.",
            },
            {
              icon: Activity,
              title: "Weighted probabilities",
              body: "Likely conditions ranked by percentage with plain-English rationale for each.",
            },
            {
              icon: ShieldAlert,
              title: "Red-flag protocol",
              body: "Symptoms like chest pain or sudden weakness immediately route you to emergency care.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur transition hover:border-neon/40"
            >
              <div className="mb-4 inline-flex size-10 items-center justify-center rounded-xl bg-neon/10 text-neon">
                <f.icon className="size-5" />
              </div>
              <h3 className="font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
