import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ThreadSidebar } from "@/components/ThreadSidebar";
import { ChatWindow } from "@/components/ChatWindow";
import type { Thread } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/app")({
  component: AppPage,
  head: () => ({ meta: [{ title: "Triage — Symptom check" }] }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
});

function AppPage() {
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadThreads = useCallback(async () => {
    const { data, error } = await supabase
      .from("threads")
      .select("id, title, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error("Could not load history");
      return [] as Thread[];
    }
    setThreads(data ?? []);
    return data ?? [];
  }, []);

  const ensureThread = useCallback(async () => {
    const list = await loadThreads();
    if (list.length === 0) {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: created, error } = await supabase
        .from("threads")
        .insert({ user_id: u.user.id })
        .select()
        .single();
      if (error || !created) {
        toast.error("Could not start a session");
        return;
      }
      setThreads([created]);
      setActiveId(created.id);
    } else {
      setActiveId((prev) => prev ?? list[0].id);
    }
    setLoading(false);
  }, [loadThreads]);

  useEffect(() => {
    ensureThread();
  }, [ensureThread]);

  const handleNewThread = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: created, error } = await supabase
      .from("threads")
      .insert({ user_id: u.user.id })
      .select()
      .single();
    if (error || !created) {
      toast.error("Could not create thread");
      return;
    }
    setThreads((t) => [created, ...t]);
    setActiveId(created.id);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("threads").delete().eq("id", id);
    if (error) {
      toast.error("Could not delete");
      return;
    }
    const remaining = threads.filter((t) => t.id !== id);
    setThreads(remaining);
    if (activeId === id) {
      setActiveId(remaining[0]?.id ?? null);
      if (remaining.length === 0) await ensureThread();
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const handleThreadTitleChange = (id: string, title: string) => {
    setThreads((arr) =>
      arr.map((t) => (t.id === id ? { ...t, title, updated_at: new Date().toISOString() } : t)),
    );
  };

  if (loading || !activeId) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <ThreadSidebar
        threads={threads}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={handleNewThread}
        onDelete={handleDelete}
        onSignOut={handleSignOut}
      />
      <main className="flex-1 overflow-hidden">
        <ChatWindow
          key={activeId}
          threadId={activeId}
          onAfterFirstMessage={(title) => handleThreadTitleChange(activeId, title)}
        />
      </main>
    </div>
  );
}
