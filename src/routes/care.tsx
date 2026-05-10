import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Phone,
  Navigation,
  Globe,
  Loader2,
  AlertTriangle,
  Hospital,
  Stethoscope,
  Video,
  Pill,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/care")({
  component: CarePage,
  head: () => ({ meta: [{ title: "Find care — Triage" }] }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
});

type Severity = "low" | "medium" | "high";

type Place = {
  id: string;
  name: string;
  category: "hospital" | "clinic" | "pharmacy" | "doctor";
  lat: number;
  lon: number;
  distanceKm: number;
  phone?: string;
  website?: string;
  address?: string;
  emergency?: boolean;
};

type Coords = { lat: number; lon: number };

const TELEHEALTH = [
  { name: "Teladoc Health", url: "https://www.teladoc.com/", desc: "24/7 virtual visits with licensed doctors" },
  { name: "Amwell", url: "https://patients.amwell.com/", desc: "On-demand video consultations" },
  { name: "MDLIVE", url: "https://www.mdlive.com/", desc: "Urgent care, therapy & dermatology online" },
  { name: "Doctor on Demand", url: "https://www.doctorondemand.com/", desc: "Video visits in minutes" },
];

const SEVERITIES: { id: Severity; label: string; desc: string; tone: string }[] = [
  { id: "low", label: "Low", desc: "Mild rash, common cold, minor pain", tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" },
  { id: "medium", label: "Moderate", desc: "Persistent fever, sprains, infections", tone: "border-amber-500/40 bg-amber-500/10 text-amber-400" },
  { id: "high", label: "Severe / Emergency", desc: "Chest pain, severe bleeding, trouble breathing", tone: "border-destructive/40 bg-destructive/10 text-destructive" },
];

function haversine(a: Coords, b: Coords) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

async function fetchNearby(coords: Coords, severity: Severity): Promise<Place[]> {
  const radius = severity === "high" ? 50000 : severity === "medium" ? 30000 : 15000;
  // For high severity, prioritize hospitals/ER. Low severity → clinics + pharmacies.
  const filters =
    severity === "high"
      ? `node["amenity"="hospital"](around:${radius},${coords.lat},${coords.lon});way["amenity"="hospital"](around:${radius},${coords.lat},${coords.lon});`
      : severity === "medium"
        ? `node["amenity"~"hospital|clinic|doctors"](around:${radius},${coords.lat},${coords.lon});way["amenity"~"hospital|clinic|doctors"](around:${radius},${coords.lat},${coords.lon});`
        : `node["amenity"~"clinic|doctors|pharmacy"](around:${radius},${coords.lat},${coords.lon});way["amenity"~"clinic|doctors|pharmacy"](around:${radius},${coords.lat},${coords.lon});`;

  const query = `[out:json][timeout:25];(${filters});out center tags 40;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: query,
  });
  if (!res.ok) throw new Error("Could not reach OpenStreetMap");
  const json = (await res.json()) as {
    elements: Array<{
      id: number;
      type: string;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    }>;
  };

  const places: Place[] = [];
  for (const el of json.elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const tags = el.tags ?? {};
    if (lat == null || lon == null || !tags.name) continue;
    const amenity = tags.amenity;
    const cat: Place["category"] =
      amenity === "hospital" ? "hospital" : amenity === "pharmacy" ? "pharmacy" : amenity === "clinic" ? "clinic" : "doctor";
    const addressParts = [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"]].filter(Boolean);
    places.push({
      id: `${el.type}/${el.id}`,
      name: tags.name,
      category: cat,
      lat,
      lon,
      distanceKm: haversine(coords, { lat, lon }),
      phone: tags.phone || tags["contact:phone"],
      website: tags.website || tags["contact:website"],
      address: addressParts.length ? addressParts.join(" ") : undefined,
      emergency: tags.emergency === "yes" || cat === "hospital",
    });
  }
  places.sort((a, b) => a.distanceKm - b.distanceKm);
  return places.slice(0, 20);

  return places;
}

const CategoryIcon = ({ category }: { category: Place["category"] }) => {
  if (category === "hospital") return <Hospital className="size-4 text-destructive" />;
  if (category === "pharmacy") return <Pill className="size-4 text-emerald-400" />;
  return <Stethoscope className="size-4 text-neon" />;
};

function CarePage() {
  const [severity, setSeverity] = useState<Severity>("low");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const requestLocation = () => {
    if (!("geolocation" in navigator)) {
      setGeoError("Geolocation isn't supported in this browser.");
      return;
    }
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => setGeoError(err.message || "Couldn't get your location"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  useEffect(() => {
    if (!coords) return;
    setLoading(true);
    fetchNearby(coords, severity)
      .then(setPlaces)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Search failed"))
      .finally(() => setLoading(false));
  }, [coords, severity]);

  const sev = SEVERITIES.find((s) => s.id === severity)!;

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <header className="mb-6">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Find care near you</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            We use your device location to suggest the right level of care based on symptom severity.
          </p>
        </header>

        {/* Severity selector */}
        <section className="mb-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Symptom severity</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {SEVERITIES.map((s) => {
              const active = s.id === severity;
              return (
                <button
                  key={s.id}
                  onClick={() => setSeverity(s.id)}
                  className={`rounded-lg border p-3 text-left transition ${active ? s.tone : "border-border bg-card hover:border-foreground/20"}`}
                >
                  <div className="text-sm font-semibold">{s.label}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{s.desc}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Emergency banner */}
        {severity === "high" && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="font-semibold text-destructive">If this is a life-threatening emergency, call now.</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Don't wait for a clinic. Emergency services can reach you faster than you can reach them.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild variant="destructive" size="sm">
                  <a href="tel:911"><Phone className="mr-1 size-4" /> Call 911 (US)</a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href="tel:112"><Phone className="mr-1 size-4" /> 112 (EU)</a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href="tel:999"><Phone className="mr-1 size-4" /> 999 (UK)</a>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Location prompt */}
        {!coords ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <MapPin className="mx-auto size-8 text-neon" />
            <p className="mt-3 text-sm">Share your location to find nearby care providers.</p>
            <Button onClick={requestLocation} className="mt-4">
              <MapPin className="mr-2 size-4" /> Use my location
            </Button>
            {geoError && <p className="mt-3 text-xs text-destructive">{geoError}</p>}
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" /> {coords.lat.toFixed(3)}, {coords.lon.toFixed(3)}
              </span>
              <button onClick={requestLocation} className="hover:text-foreground">Refresh location</button>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Searching {sev.label.toLowerCase()} care nearby…
              </div>
            ) : places.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No {severity === "high" ? "hospitals" : "providers"} found nearby. Try a broader severity.
              </p>
            ) : (
              <ul className="space-y-2">
                {places.map((p) => {
                  const dirUrl = `https://www.openstreetmap.org/directions?from=${coords.lat},${coords.lon}&to=${p.lat},${p.lon}`;
                  return (
                    <li key={p.id} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <CategoryIcon category={p.category} />
                            <h3 className="truncate font-medium">{p.name}</h3>
                            {p.emergency && (
                              <span className="rounded-full border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-destructive">
                                ER
                              </span>
                            )}
                          </div>
                          {p.address && <p className="mt-0.5 truncate text-xs text-muted-foreground">{p.address}</p>}
                          <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                            {p.category} · {p.distanceKm.toFixed(1)} km away
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {p.phone && (
                          <Button asChild size="sm" variant="outline">
                            <a href={`tel:${p.phone.replace(/\s/g, "")}`}><Phone className="mr-1 size-3.5" /> Call</a>
                          </Button>
                        )}
                        <Button asChild size="sm" variant="outline">
                          <a href={dirUrl} target="_blank" rel="noreferrer noopener">
                            <Navigation className="mr-1 size-3.5" /> Directions
                          </a>
                        </Button>
                        {p.website && (
                          <Button asChild size="sm" variant="outline">
                            <a href={p.website} target="_blank" rel="noreferrer noopener">
                              <Globe className="mr-1 size-3.5" /> Website
                            </a>
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {/* Telehealth (low severity) */}
        {severity !== "high" && (
          <section className="mt-10">
            <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
              <Video className="size-4 text-neon" />
              <h2 className="font-display text-lg font-semibold">Virtual telehealth</h2>
              <span className="ml-auto text-xs text-muted-foreground">Talk to a clinician from home</span>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {TELEHEALTH.map((t) => (
                <li key={t.url}>
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block rounded-lg border border-border bg-card p-3 transition hover:border-neon/40"
                  >
                    <div className="font-medium">{t.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{t.desc}</div>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Provider data from OpenStreetMap. Not affiliated with any listed service. Always confirm hours and availability before visiting.
        </p>
      </main>
    </div>
  );
}
