import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Luggage, Search } from "lucide-react";
import { OCCASIONS, type ItemDTO, type Occasion, type WeatherDTO } from "@fashionos/shared";
import { api } from "../lib/api";
import { fmtDate, todayStr } from "../lib/utils";
import { Chips, Field, PageHeader, Spinner } from "../components/ui";
import { Collage } from "../components/Collage";
import { ItemCard } from "../components/ItemCard";

interface Place { name: string; admin: string; country: string; lat: number; lon: number }
interface PackingResult { days: { date: string; occasion: Occasion; weather: WeatherDTO | null; itemIds: string[]; title: string; explanation: string }[]; items: ItemDTO[] }

export default function Packing() {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [place, setPlace] = useState<Place | null>(null);
  const [start, setStart] = useState(todayStr(1));
  const [days, setDays] = useState(3);
  const [occasions, setOccasions] = useState<Occasion[]>(["daily"]);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const search = async () => {
    if (query.trim().length < 2) return;
    const r = await api.get<{ results: Place[] }>(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
    setPlaces(r.results);
  };
  const m = useMutation({
    mutationFn: () => api.post<PackingResult>("/api/outfits/packing", { destination: place?.name ?? "", lat: place?.lat ?? null, lon: place?.lon ?? null, startDate: start, days, occasions: occasions.length ? occasions : ["daily"] }),
    onSuccess: () => setChecked(new Set()),
  });
  const map = new Map((m.data?.items ?? []).map((i) => [i.id, i]));

  return (
    <div className="pb-8">
      <PageHeader title="Valiz hazırla" subtitle="Seyahat günlerine göre en az parçayla en çok kombin" />
      <div className="space-y-4 px-4">
        <Field label="Nereye?">
          <div className="flex gap-2">
            <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Şehir ara (boş bırakırsan kendi şehrin)" />
            <button className="btn-secondary px-3" onClick={search} aria-label="Ara"><Search className="h-4 w-4" /></button>
          </div>
        </Field>
        {places.length > 0 && !place && (
          <div className="card divide-y divide-stone-100">
            {places.map((p) => (
              <button key={`${p.lat},${p.lon}`} className="block w-full px-4 py-2.5 text-left text-sm" onClick={() => { setPlace(p); setQuery(p.name); setPlaces([]); }}>
                {p.name} <span className="text-stone-500">{[p.admin, p.country].filter(Boolean).join(", ")}</span>
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Başlangıç"><input type="date" className="input" value={start} min={todayStr()} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Kaç gün?"><input type="number" className="input" min={1} max={30} value={days} onChange={(e) => setDays(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} /></Field>
        </div>
        <div>
          <span className="label">Neler yapacaksın?</span>
          <Chips multi options={OCCASIONS} value={occasions} onChange={(v: Occasion[]) => setOccasions(v)} />
        </div>
        <button className="btn-primary w-full py-3" onClick={() => m.mutate()} disabled={m.isPending}>
          {m.isPending ? <Spinner className="text-paper" /> : <><Luggage className="h-4 w-4" /> Valiz listesini çıkar</>}
        </button>
        {m.error && <p className="text-sm text-red-700">{(m.error as Error).message}</p>}
      </div>

      {m.data && (
        <div className="mt-6 space-y-6 px-4">
          <section>
            <h2 className="mb-1 font-display text-xl">Valizine koy ({m.data.items.length} parça)</h2>
            <p className="mb-3 text-xs text-stone-500">Koyduklarını işaretle.</p>
            <div className="grid grid-cols-3 gap-3">
              {m.data.items.map((i) => (
                <div key={i.id} className={checked.has(i.id) ? "opacity-40" : ""}>
                  <ItemCard item={i} onClick={() => setChecked((c) => { const n = new Set(c); n.has(i.id) ? n.delete(i.id) : n.add(i.id); return n; })} selected={checked.has(i.id)} />
                </div>
              ))}
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="font-display text-xl">Gün gün</h2>
            {m.data.days.map((d) => (
              <div key={d.date} className="card flex gap-3 p-3">
                <Collage items={d.itemIds.map((id) => map.get(id)!).filter(Boolean)} className="w-24 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{fmtDate(d.date, { weekday: "long", day: "numeric", month: "long" })}</p>
                  <p className="text-xs text-stone-500">{OCCASIONS[d.occasion]}{d.weather ? ` · ${d.weather.condition}, ${d.weather.minC}°–${d.weather.maxC}°` : ""}</p>
                  <p className="mt-1 text-sm">{d.title}</p>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
