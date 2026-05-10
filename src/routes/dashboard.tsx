import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Activity, Droplet, Moon, Footprints, Smile, Scale } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type Metric = {
  id: string;
  recorded_on: string;
  weight_kg: number | null;
  height_cm: number | null;
  water_ml: number | null;
  sleep_hours: number | null;
  steps: number | null;
  mood: number | null;
  notes: string | null;
};

type Range = "week" | "month" | "year";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Health dashboard — Symptom Compass" }] }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
});

function DashboardPage() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("week");
  const [form, setForm] = useState({
    weight_kg: "",
    height_cm: "",
    water_ml: "",
    sleep_hours: "",
    steps: "",
    mood: "",
    notes: "",
  });

  const load = async () => {
    const { data, error } = await supabase
      .from("health_metrics")
      .select("*")
      .order("recorded_on", { ascending: false })
      .limit(500);
    if (error) toast.error("Could not load metrics");
    else setMetrics((data ?? []) as Metric[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const num = (s: string) => (s.trim() === "" ? null : Number(s));
    const { error } = await supabase.from("health_metrics").insert({
      user_id: u.user.id,
      weight_kg: num(form.weight_kg),
      height_cm: num(form.height_cm),
      water_ml: num(form.water_ml),
      sleep_hours: num(form.sleep_hours),
      steps: num(form.steps),
      mood: num(form.mood),
      notes: form.notes || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Logged");
    setForm({ weight_kg: "", height_cm: "", water_ml: "", sleep_hours: "", steps: "", mood: "", notes: "" });
    load();
  };

  const today = metrics[0];
  const bmi = useMemo(() => {
    const w = today?.weight_kg ?? lastNonNull(metrics, "weight_kg");
    const h = today?.height_cm ?? lastNonNull(metrics, "height_cm");
    if (!w || !h) return null;
    const m = h / 100;
    return w / (m * m);
  }, [metrics, today]);

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-semibold">Health dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Track baseline metrics. Symptom Compass references your last logs when assessing symptoms.
          </p>
        </div>

        <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat icon={Scale} label="BMI" value={bmi ? bmi.toFixed(1) : "—"} hint={bmi ? bmiLabel(bmi) : "Log weight & height"} />
          <Stat icon={Droplet} label="Water (ml)" value={today?.water_ml ?? "—"} hint="today" />
          <Stat icon={Moon} label="Sleep (h)" value={today?.sleep_hours ?? "—"} hint="last log" />
          <Stat icon={Footprints} label="Steps" value={today?.steps?.toLocaleString() ?? "—"} hint="last log" />
        </section>

        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Trends</h2>
            <div className="inline-flex rounded-lg border border-border bg-card/40 p-0.5 text-xs">
              {(["week", "month", "year"] as Range[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`rounded-md px-3 py-1 capitalize transition ${range === r ? "bg-neon/15 text-neon" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {r === "week" ? "Weekly" : r === "month" ? "Monthly" : "Yearly"}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <MetricChart title="Weight" unit="kg" color="hsl(160 84% 50%)" metrics={metrics} field="weight_kg" range={range} agg="avg" />
            <MetricChart title="Water" unit="ml" color="hsl(199 89% 60%)" metrics={metrics} field="water_ml" range={range} agg="sum" />
            <MetricChart title="Sleep" unit="h" color="hsl(258 90% 70%)" metrics={metrics} field="sleep_hours" range={range} agg="avg" />
            <MetricChart title="Steps" unit="" color="hsl(152 76% 55%)" metrics={metrics} field="steps" range={range} agg="sum" />
            <MetricChart title="Mood" unit="/5" color="hsl(38 92% 55%)" metrics={metrics} field="mood" range={range} agg="avg" />
          </div>
        </section>

        <section className="mb-10 rounded-2xl border border-border bg-card/40 p-6">
          <h2 className="mb-4 font-display text-base font-semibold">Log today</h2>

          <form onSubmit={submit} className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <Field label="Weight (kg)" value={form.weight_kg} onChange={(v) => setForm({ ...form, weight_kg: v })} type="number" step="0.1" />
            <Field label="Height (cm)" value={form.height_cm} onChange={(v) => setForm({ ...form, height_cm: v })} type="number" step="0.1" />
            <Field label="Water (ml)" value={form.water_ml} onChange={(v) => setForm({ ...form, water_ml: v })} type="number" />
            <Field label="Sleep (hours)" value={form.sleep_hours} onChange={(v) => setForm({ ...form, sleep_hours: v })} type="number" step="0.1" />
            <Field label="Steps" value={form.steps} onChange={(v) => setForm({ ...form, steps: v })} type="number" />
            <Field label="Mood (1-5)" value={form.mood} onChange={(v) => setForm({ ...form, mood: v })} type="number" min="1" max="5" />
            <div className="col-span-2 md:col-span-3">
              <Label className="mb-1.5 block text-xs">Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="How are you feeling?" />
            </div>
            <div className="col-span-2 md:col-span-3 flex justify-end">
              <Button type="submit" className="glow-neon">
                <Activity className="mr-1 size-4" /> Save entry
              </Button>
            </div>
          </form>
        </section>

        <section>
          <h2 className="mb-4 font-display text-base font-semibold">Recent entries</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : metrics.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries yet — log your first one above.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-card/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <Th>Date</Th><Th>Weight</Th><Th>Water</Th><Th>Sleep</Th><Th>Steps</Th><Th>Mood</Th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr key={m.id} className="border-t border-border/60">
                      <Td>{m.recorded_on}</Td>
                      <Td>{m.weight_kg ?? "—"}{m.weight_kg ? " kg" : ""}</Td>
                      <Td>{m.water_ml ?? "—"}{m.water_ml ? " ml" : ""}</Td>
                      <Td>{m.sleep_hours ?? "—"}{m.sleep_hours ? " h" : ""}</Td>
                      <Td>{m.steps?.toLocaleString() ?? "—"}</Td>
                      <Td><MoodFace n={m.mood} /></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

type FieldProps = { label: string; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">;
function Field({ label, value, onChange, ...rest }: FieldProps) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5 text-neon" />
        {label}
      </div>
      <div className="font-display text-2xl font-semibold">{value}</div>
      <div className="text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-left font-medium">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2">{children}</td>;
}

function MoodFace({ n }: { n: number | null }) {
  if (!n) return <span>—</span>;
  const faces = ["😞", "😕", "😐", "🙂", "😄"];
  return <span className="inline-flex items-center gap-1"><Smile className="size-3.5 text-neon" />{faces[n - 1] ?? "—"}</span>;
}

function bmiLabel(b: number) {
  if (b < 18.5) return "Underweight";
  if (b < 25) return "Healthy";
  if (b < 30) return "Overweight";
  return "Obese";
}

function lastNonNull(arr: Metric[], key: keyof Metric): number | null {
  for (const m of arr) {
    const v = m[key];
    if (typeof v === "number") return v;
  }
  return null;
}

type ChartField = "weight_kg" | "water_ml" | "sleep_hours" | "steps" | "mood";

function MetricChart({
  title,
  unit,
  color,
  metrics,
  field,
  range,
  agg,
}: {
  title: string;
  unit: string;
  color: string;
  metrics: Metric[];
  field: ChartField;
  range: Range;
  agg: "avg" | "sum";
}) {
  const data = useMemo(() => buildSeries(metrics, field, range, agg), [metrics, field, range, agg]);
  const hasData = data.some((d) => d.value != null);

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-[11px] text-muted-foreground">{unit}</span>
      </div>
      <div className="h-40">
        {!hasData ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No data for this range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`g-${field}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={40} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                formatter={(v: number) => [unit ? `${v} ${unit}` : v, title]}
              />
              <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#g-${field})`} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function buildSeries(metrics: Metric[], field: ChartField, range: Range, agg: "avg" | "sum") {
  const now = new Date();
  const buckets: { key: string; label: string; start: Date; end: Date }[] = [];

  if (range === "week") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const end = new Date(d);
      end.setDate(end.getDate() + 1);
      buckets.push({
        key: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString(undefined, { weekday: "short" }),
        start: d,
        end,
      });
    }
  } else if (range === "month") {
    // 4 weeks (last 28 days grouped by week)
    for (let i = 3; i >= 0; i--) {
      const end = new Date(now);
      end.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - i * 7);
      end.setDate(end.getDate() + 1);
      const start = new Date(end);
      start.setDate(start.getDate() - 7);
      buckets.push({
        key: `w${i}`,
        label: `W${4 - i}`,
        start,
        end,
      });
    }
  } else {
    // 12 months
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      buckets.push({
        key: `${start.getFullYear()}-${start.getMonth()}`,
        label: start.toLocaleDateString(undefined, { month: "short" }),
        start,
        end,
      });
    }
  }

  return buckets.map((b) => {
    const vals: number[] = [];
    for (const m of metrics) {
      const v = m[field];
      if (typeof v !== "number") continue;
      const d = new Date(m.recorded_on);
      if (d >= b.start && d < b.end) vals.push(v);
    }
    if (vals.length === 0) return { label: b.label, value: null as number | null };
    const result = agg === "sum" ? vals.reduce((a, c) => a + c, 0) : vals.reduce((a, c) => a + c, 0) / vals.length;
    return { label: b.label, value: Math.round(result * 100) / 100 };
  });
}
