import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Dependent = {
  id: string;
  owner_id: string;
  name: string;
  relation: "self" | "child" | "parent" | "partner" | "other";
  date_of_birth: string | null;
  sex: "male" | "female" | "other" | "unspecified";
  notes: string | null;
  is_default: boolean;
  created_at: string;
};

const KEY = "triage:active_profile_id";

export function getActiveProfileId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function setActiveProfileId(id: string) {
  localStorage.setItem(KEY, id);
  window.dispatchEvent(new CustomEvent("active-profile-changed", { detail: id }));
}

export async function ensureDefaultProfile(): Promise<Dependent | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data: existing } = await supabase
    .from("profiles_dependents")
    .select("*")
    .eq("owner_id", u.user.id)
    .order("created_at", { ascending: true });
  if (existing && existing.length > 0) {
    const def = existing.find((d) => d.is_default) ?? existing[0];
    return def as Dependent;
  }
  const name = u.user.email?.split("@")[0] ?? "Me";
  const { data: created } = await supabase
    .from("profiles_dependents")
    .insert({ owner_id: u.user.id, name, relation: "self", is_default: true })
    .select()
    .single();
  return (created ?? null) as Dependent | null;
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<Dependent[]>([]);
  const [activeId, setActive] = useState<string | null>(getActiveProfileId());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const def = await ensureDefaultProfile();
    const { data } = await supabase
      .from("profiles_dependents")
      .select("*")
      .order("created_at", { ascending: true });
    const list = (data ?? []) as Dependent[];
    setProfiles(list);
    let active = getActiveProfileId();
    if (!active || !list.find((p) => p.id === active)) {
      active = def?.id ?? list[0]?.id ?? null;
      if (active) setActiveProfileId(active);
    }
    setActive(active);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    const onChange = (e: Event) => {
      const ce = e as CustomEvent<string>;
      setActive(ce.detail);
    };
    window.addEventListener("active-profile-changed", onChange);
    return () => window.removeEventListener("active-profile-changed", onChange);
  }, [reload]);

  const active = profiles.find((p) => p.id === activeId) ?? null;
  return { profiles, active, activeId, loading, reload, setActive: setActiveProfileId };
}

export function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}
