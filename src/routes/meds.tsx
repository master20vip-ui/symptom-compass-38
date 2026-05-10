import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Pill, Plus, Trash2, X } from "lucide-react";
import { useProfiles } from "@/lib/active-profile";

type Med = {
  id: string;
  profile_id: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  kind: "prescription" | "otc" | "supplement";
  started_on: string | null;
  ended_on: string | null;
  notes: string | null;
  common_side_effects: string[];
};

const KINDS = ["prescription", "otc", "supplement"] as const;
const KIND_LABEL: Record<Med["kind"], string> = {
  prescription: "Prescription",
  otc: "Over-the-counter",
  supplement: "Supplement",
};

export const Route = createFileRoute("/meds")({
  component: MedsPage,
  head: () => ({ meta: [{ title: "Medications — Symptom Compass" }] }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
});

function MedsPage() {
  const { active, activeId, loading: profilesLoading } = useProfiles();
  const [meds, setMeds] = useState<Med[]>([]);
  const [open, setOpen] = useState(false);
  const [sideEffectInput, setSideEffectInput] = useState("");
  const [form, setForm] = useState({
    name: "",
    dosage: "",
    frequency: "",
    kind: "prescription" as Med["kind"],
    started_on: "",
    notes: "",
    common_side_effects: [] as string[],
  });

  const load = async () => {
    if (!activeId) return;
    const { data, error } = await supabase
      .from("medications")
      .select("*")
      .eq("profile_id", activeId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setMeds((data ?? []) as Med[]);
  };

  useEffect(() => {
    load();
  }, [activeId]);

  const addSideEffect = () => {
    const v = sideEffectInput.trim().toLowerCase();
    if (!v) return;
    if (form.common_side_effects.includes(v)) return;
    setForm({ ...form, common_side_effects: [...form.common_side_effects, v] });
    setSideEffectInput("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user || !activeId) return;
    const { error } = await supabase.from("medications").insert({
      user_id: u.user.id,
      profile_id: activeId,
      name: form.name,
      dosage: form.dosage || null,
      frequency: form.frequency || null,
      kind: form.kind,
      started_on: form.started_on || null,
      notes: form.notes || null,
      common_side_effects: form.common_side_effects,
    });
    if (error) return toast.error(error.message);
    toast.success("Medication added");
    setForm({ name: "", dosage: "", frequency: "", kind: "prescription", started_on: "", notes: "", common_side_effects: [] });
    setOpen(false);
    load();
  };

  const endMed = async (id: string) => {
    const { error } = await supabase
      .from("medications")
      .update({ ended_on: new Date().toISOString().slice(0, 10) })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marked as ended");
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this medication?")) return;
    const { error } = await supabase.from("medications").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const grouped = (kind: Med["kind"]) => meds.filter((m) => m.kind === kind && !m.ended_on);
  const ended = meds.filter((m) => m.ended_on);

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold">Medications</h1>
            <p className="text-sm text-muted-foreground">
              {active ? `Tracking for ${active.name}.` : "Pick a profile to start."}{" "}
              Symptom Compass cross-references this list when you describe symptoms.
            </p>
          </div>
          <Button onClick={() => setOpen((v) => !v)} disabled={!activeId} className="glow-neon">
            <Plus className="mr-1 size-4" /> Add medication
          </Button>
        </div>

        {open && (
          <form onSubmit={submit} className="mb-8 grid grid-cols-2 gap-4 rounded-2xl border border-border bg-card/40 p-6 md:grid-cols-3">
            <div>
              <Label className="mb-1.5 block text-xs">Name</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Lisinopril" />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Dosage</Label>
              <Input value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder="10 mg" />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Frequency</Label>
              <Input value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} placeholder="Once daily" />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Kind</Label>
              <select
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as Med["kind"] })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Started on</Label>
              <Input type="date" value={form.started_on} onChange={(e) => setForm({ ...form, started_on: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="md:col-span-3">
              <Label className="mb-1.5 block text-xs">Known side effects</Label>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {form.common_side_effects.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-xs">
                    {s}
                    <button type="button" onClick={() => setForm({ ...form, common_side_effects: form.common_side_effects.filter((x) => x !== s) })}>
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={sideEffectInput}
                  onChange={(e) => setSideEffectInput(e.target.value)}
                  placeholder="dizziness, dry cough…"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSideEffect(); } }}
                />
                <Button type="button" variant="secondary" onClick={addSideEffect}>Add</Button>
              </div>
            </div>
            <div className="col-span-2 flex justify-end md:col-span-3">
              <Button type="submit">Save medication</Button>
            </div>
          </form>
        )}

        {profilesLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-8">
            {KINDS.map((k) => (
              <Section key={k} title={KIND_LABEL[k]} meds={grouped(k)} onEnd={endMed} onDelete={del} />
            ))}
            {ended.length > 0 && (
              <Section title="Past medications" meds={ended} onDelete={del} muted />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function Section({ title, meds, onEnd, onDelete, muted }: { title: string; meds: Med[]; onEnd?: (id: string) => void; onDelete: (id: string) => void; muted?: boolean }) {
  return (
    <section>
      <h2 className={`mb-3 font-display text-sm font-semibold uppercase tracking-wider ${muted ? "text-muted-foreground" : ""}`}>{title}</h2>
      {meds.length === 0 ? (
        <p className="text-xs text-muted-foreground">None.</p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {meds.map((m) => (
            <div key={m.id} className={`rounded-xl border p-3 ${muted ? "border-border/40 bg-card/20 opacity-70" : "border-border bg-card/40"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Pill className="size-4 text-neon" />
                    <h3 className="font-display text-sm font-semibold">{m.name}</h3>
                    {m.dosage && <span className="text-xs text-muted-foreground">{m.dosage}</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {m.frequency ?? "—"}
                    {m.started_on && ` · since ${m.started_on}`}
                    {m.ended_on && ` · ended ${m.ended_on}`}
                  </p>
                  {m.common_side_effects.length > 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Side effects: {m.common_side_effects.join(", ")}
                    </p>
                  )}
                  {m.notes && <p className="mt-1 text-xs">{m.notes}</p>}
                </div>
                <div className="flex gap-1">
                  {onEnd && !m.ended_on && (
                    <Button variant="ghost" size="sm" onClick={() => onEnd(m.id)} title="Mark as ended">End</Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => onDelete(m.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
