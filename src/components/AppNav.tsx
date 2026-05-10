import { Link, useNavigate } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { Button } from "./ui/button";
import { MessageSquareText, Activity, BookOpen, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const items = [
  { to: "/app", label: "Symptom check", icon: MessageSquareText },
  { to: "/dashboard", label: "Health dashboard", icon: Activity },
  { to: "/library", label: "Disease library", icon: BookOpen },
] as const;

export function AppNav() {
  const navigate = useNavigate();
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
      <Button onClick={signOut} variant="ghost" size="sm">
        <LogOut className="mr-2 size-4" /> Sign out
      </Button>
    </header>
  );
}
