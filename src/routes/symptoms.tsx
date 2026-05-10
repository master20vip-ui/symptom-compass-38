import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Activity, Plus, Trash2 } from "lucide-react";
import { useProfiles } from "@/lib/active-profile";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

type Log = {
  id: string;
  profile_id: string;
  symptom: string;
  severity: number;
  notes: string | null;
  logged_at: string;
};

export const Route = createFileRoute("/symptoms")({
  component: SymptomsPage,
  head: () => ({ meta: [{ title: "Symptom tracker — Symptom Compass" }] }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
});

function SymptomsPage() {
  const { active, activeId } = useProfiles();
  const [logs, setLogs] = useState<Log[]>([]);
  const [form, setForm] = useState({ symptom: "", severity: "3", notes: "" });

  const load = async () => {
    if (!activeId) return;
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("symptom_logs")
      .select("*")
      .eq("profile_id", activeId)
      .gte("logged_at", since)
      .order("logged_at", { ascending: false });
    if (error) toast.error(error.message);
    else setLogs((data ?? []) as Log[]);
  };
  useEffect(() => { load(); }, [activeId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user || !activeId) return;
    const { error } = await supabase.from("symptom_logs").insert({
      user_id: u.user.id,
      profile_id: activeId,
      symptom: form.symptom.trim().toLowerCase(),
      severity: Math.min(5, Math.max(1, Number(form.severity) || 3)),
      notes: form.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Logged");
    setForm({ symptom: "", severity: "3", notes: "" });
    load();
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("symptom_logs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const grouped = useMemo(() => {
    const map = new Map<string, Log[]>();
    for (const l of logs) {
      const arr = map.get(l.symptom) ?? [];
      arr.push(l);
      map.set(l.symptom, arr);
    }
    return Array.from(map.entries()).sort((a, b) =>
      new Date(b[1][0].logged_at).getTime() - new Date(a[1][0].logged_at).getTime()
    );
  }, [logs]);

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold">Symptom tracker</h1>
          <p className="text-sm text-muted-foreground">
            {active ? `Tracking for ${active.name}.` : ""} Log symptoms over time. Symptom Compass escalates when symptoms linger or worsen.
          </p>
        </div>

        <form onSubmit={submit} className="mb-8 grid grid-cols-2 gap-4 rounded-2xl border border-border bg-card/40 p-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label className="mb-1.5 block text-xs">Symptom</Label>
            <Input required value={form.symptom} onChange={(e) => setForm({ ...form, symptom: e.target.value })} placeholder="dry cough" />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Severity (1–5)</Label>
            <Input type="number" min="1" max="5" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full glow-neon">
              <Plus className="mr-1 size-4" /> Log
            </Button>
          </div>
          <div className="md:col-span-4">
            <Label className="mb-1.5 block text-xs">Notes (optional)</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Worse at night, productive…" />
          </div>
        </form>

        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground">No symptoms logged yet.</p>
        ) : (
          <div className="space-y-4">
            {grouped.map(([symptom, items]) => (
              <SymptomCard key={symptom} symptom={symptom} items={items} onDelete={del} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function SymptomCard({ symptom, items, onDelete }: { symptom: string; items: Log[]; onDelete: (id: string) => void }) {
  const sorted = [...items].sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());
  const first = new Date(sorted[0].logged_at);
  const last = new Date(sorted[sorted.length - 1].logged_at);
  const days = Math.max(1, Math.floor((last.getTime() - first.getTime()) / 86400000) + 1);
  const tone = days >= 21 ? "border-destructive/50 bg-destructive/5 text-destructive" : days >= 7 ? "border-amber-500/50 bg-amber-500/5 text-amber-500" : "border-neon/40 bg-neon/5 text-neon";

  const data = sorted.map((l) => ({
    label: new Date(l.logged_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    value: l.severity,
  }));

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-neon" />
          <h3 className="font-display text-base font-semibold capitalize">{symptom}</h3>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tone}`}>
            {days >= 21 ? "Chronic" : days >= 7 ? "Lingering" : "Recent"} · {days}d
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{items.length} entries</span>
      </div>

      {data.length >= 2 && (
        <div className="mb-3 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`s-${symptom}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(160 84% 50%)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(160 84% 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={30} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="value" stroke="hsl(160 84% 50%)" strokeWidth={2} fill={`url(#s-${symptom})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <ul className="space-y-1 text-xs">
        {[...items].slice(0, 5).map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-muted/30">
            <span>
              {new Date(l.logged_at).toLocaleString()} · severity {l.severity}/5
              {l.notes && <span className="text-muted-foreground"> — {l.notes}</span>}
            </span>
            <button onClick={() => onDelete(l.id)} className="opacity-50 hover:opacity-100">
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
