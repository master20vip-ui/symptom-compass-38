import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Users, Plus, Trash2, Check } from "lucide-react";
import { useProfiles, ageFromDob, type Dependent } from "@/lib/active-profile";

export const Route = createFileRoute("/family")({
  component: FamilyPage,
  head: () => ({ meta: [{ title: "Family profiles — Symptom Compass" }] }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
});

const RELATIONS = ["self", "child", "parent", "partner", "other"] as const;
const SEXES = ["unspecified", "male", "female", "other"] as const;

function FamilyPage() {
  const { profiles, activeId, loading, reload, setActive } = useProfiles();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    relation: "child" as Dependent["relation"],
    date_of_birth: "",
    sex: "unspecified" as Dependent["sex"],
    notes: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("profiles_dependents").insert({
      owner_id: u.user.id,
      name: form.name,
      relation: form.relation,
      date_of_birth: form.date_of_birth || null,
      sex: form.sex,
      notes: form.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Profile added");
    setForm({ name: "", relation: "child", date_of_birth: "", sex: "unspecified", notes: "" });
    setOpen(false);
    reload();
  };

  const del = async (id: string) => {
    if (profiles.length <= 1) return toast.error("You need at least one profile");
    if (!confirm("Delete this profile and all its meds and symptom logs?")) return;
    const { error } = await supabase.from("profiles_dependents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Profile deleted");
    reload();
  };

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold">Family profiles</h1>
            <p className="text-sm text-muted-foreground">
              Symptom Compass tailors questions and probabilities to the active profile's age & sex.
            </p>
          </div>
          <Button onClick={() => setOpen((v) => !v)} className="glow-neon">
            <Plus className="mr-1 size-4" /> Add profile
          </Button>
        </div>

        {open && (
          <form onSubmit={submit} className="mb-6 grid grid-cols-2 gap-4 rounded-2xl border border-border bg-card/40 p-6 md:grid-cols-3">
            <div>
              <Label className="mb-1.5 block text-xs">Name</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Relation</Label>
              <select
                value={form.relation}
                onChange={(e) => setForm({ ...form, relation: e.target.value as Dependent["relation"] })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Sex</Label>
              <select
                value={form.sex}
                onChange={(e) => setForm({ ...form, sex: e.target.value as Dependent["sex"] })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {SEXES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Date of birth</Label>
              <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label className="mb-1.5 block text-xs">Notes (allergies, conditions…)</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="col-span-2 flex justify-end md:col-span-3">
              <Button type="submit">Save profile</Button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {profiles.map((p) => {
              const age = ageFromDob(p.date_of_birth);
              const isActive = p.id === activeId;
              return (
                <div key={p.id} className={`rounded-2xl border p-4 transition ${isActive ? "border-neon/60 bg-neon/5" : "border-border bg-card/40"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Users className="size-4 text-neon" />
                        <h3 className="font-display text-base font-semibold">{p.name}</h3>
                        {isActive && <span className="rounded-full bg-neon/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neon">Active</span>}
                      </div>
                      <p className="mt-1 text-xs capitalize text-muted-foreground">
                        {p.relation} · {p.sex} {age != null && `· ${age}y`}
                      </p>
                      {p.notes && <p className="mt-2 text-xs text-muted-foreground">{p.notes}</p>}
                    </div>
                    <div className="flex gap-1">
                      {!isActive && (
                        <Button variant="ghost" size="sm" onClick={() => setActive(p.id)}>
                          <Check className="size-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => del(p.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
