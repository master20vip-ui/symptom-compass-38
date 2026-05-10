import { Link, useNavigate } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { Button } from "./ui/button";
import { MessageSquareText, Activity, MapPin, LogOut, Pill, Users, LineChart, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfiles } from "@/lib/active-profile";
import { useState } from "react";

const items = [
  { to: "/app", label: "Symptom check", icon: MessageSquareText },
  { to: "/symptoms", label: "Tracker", icon: LineChart },
  { to: "/meds", label: "Meds", icon: Pill },
  { to: "/care", label: "Find care", icon: MapPin },
  { to: "/dashboard", label: "Dashboard", icon: Activity },
  { to: "/family", label: "Family", icon: Users },
] as const;

export function AppNav() {
  const navigate = useNavigate();
  const { profiles, active, setActive } = useProfiles();
  const [open, setOpen] = useState(false);
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/70 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-8">
        <Logo />
        <nav className="flex items-center gap-1">
          {items.map((it) => (
            <Link
              key={it.to}
              to={it.to}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
              activeProps={{ className: "bg-accent text-foreground" }}
            >
              <it.icon className="size-4" />
              {it.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-2">
        {active && (
          <div className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-full border border-neon/40 bg-neon/10 px-3 py-1 text-xs text-neon transition hover:bg-neon/15"
            >
              <Users className="size-3.5" />
              {active.name}
              <ChevronDown className="size-3" />
            </button>
            {open && (
              <div className="absolute right-0 top-full z-30 mt-1 min-w-[180px] rounded-lg border border-border bg-popover p-1 shadow-lg">
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setActive(p.id); setOpen(false); }}
                    className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition hover:bg-accent ${p.id === active.id ? "text-neon" : ""}`}
                  >
                    <span className="capitalize">{p.name}</span>
                    <span className="text-[10px] capitalize text-muted-foreground">{p.relation}</span>
                  </button>
                ))}
                <Link
                  to="/family"
                  onClick={() => setOpen(false)}
                  className="block rounded-md border-t border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                >
                  Manage profiles…
                </Link>
              </div>
            )}
          </div>
        )}
        <Button onClick={signOut} variant="ghost" size="sm">
          <LogOut className="mr-2 size-4" /> Sign out
        </Button>
      </div>
    </header>
  );
}
