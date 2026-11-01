import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Layers, Sparkles, Trash2, Undo2, X } from "lucide-react";
import { OCCASIONS, type ItemDTO, type OutfitDTO, type SuggestResponse } from "@fashionos/shared";
import { api } from "../lib/api";
import { cn, fmtDate, todayStr } from "../lib/utils";
import { Collage } from "../components/Collage";
import { Empty, PageHeader, PageLoader, Sheet, Spinner, useToast } from "../components/ui";

type Tab = "saved" | "plan" | "history";

export default function Outfits() {
  const [tab, setTab] = useState<Tab>("plan");
  return (
    <div>
      <PageHeader title="Kombinlerim" right={<Link to="/stylist" className="btn-primary px-3"><Sparkles className="h-4 w-4" /> Yeni</Link>} />
      <div className="mx-4 flex rounded-xl bg-stone-100 p-1 text-sm">
        {([["plan", "Haftalık plan"], ["saved", "Kayıtlı"], ["history", "Geçmiş"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cn("flex-1 rounded-lg py-2", tab === k && "bg-white font-medium shadow-sm")}>{l}</button>
        ))}
      </div>
      <div className="px-4 pt-4 pb-8">
        {tab === "saved" && <Saved />}
        {tab === "plan" && <Plan />}
        {tab === "history" && <History />}
      </div>
    </div>
  );
}

function OutfitTile({ o, onDelete, onPlan }: { o: OutfitDTO; onDelete?: () => void; onPlan?: () => void }) {
  return (
    <div className="card overflow-hidden">
      <Collage items={o.items} className="rounded-none" />
      <div className="p-3">
        <p className="truncate text-sm font-medium">{o.name || "Kombin"}</p>
        <p className="text-xs text-stone-500">
          {o.occasion ? OCCASIONS[o.occasion] : ""}{o.wornCount ? ` · ${o.wornCount} kez giyildi` : ""}{o.rating === 1 ? " · 👍" : ""}
        </p>
        <div className="mt-2 flex gap-1">
          {onPlan && <button onClick={onPlan} className="btn-ghost flex-1 px-1 py-1.5 text-xs"><CalendarPlus className="h-4 w-4" /> Planla</button>}
          {onDelete && <button onClick={onDelete} className="btn-ghost px-2 py-1.5 text-red-600" aria-label="Kayıttan çıkar"><Trash2 className="h-4 w-4" /></button>}
        </div>
      </div>
    </div>
  );
}

function Saved() {
  const qc = useQueryClient();
  const toast = useToast();
  const [planFor, setPlanFor] = useState<OutfitDTO | null>(null);
  const q = useQuery({ queryKey: ["outfits", "saved"], queryFn: () => api.get<{ outfits: OutfitDTO[] }>("/api/outfits?saved=true").then((r) => r.outfits) });
  if (q.isLoading) return <PageLoader />;
  if (!q.data?.length)
    return <Empty icon={<Layers className="h-7 w-7" />} title="Kayıtlı kombin yok" text="Beğendiğin önerileri yer imi simgesiyle kaydet." action={<Link to="/" className="btn-primary">Önerilere git</Link>} />;
  const unsave = async (o: OutfitDTO) => {
    await api.patch(`/api/outfits/${o.id}`, { saved: false });
    qc.invalidateQueries({ queryKey: ["outfits"] });
    toast("Kayıttan çıkarıldı");
  };
  const plan = async (o: OutfitDTO, date: string) => {
    await api.patch(`/api/outfits/${o.id}`, { plannedFor: date });
    qc.invalidateQueries({ queryKey: ["outfits"] });
    setPlanFor(null);
    toast(`${fmtDate(date, { weekday: "long", day: "numeric", month: "long" })} için planlandı`);
  };
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {q.data.map((o) => <OutfitTile key={o.id} o={o} onDelete={() => unsave(o)} onPlan={() => setPlanFor(o)} />)}
      </div>
      <Sheet open={!!planFor} onClose={() => setPlanFor(null)} title="Hangi gün giyeceksin?">
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 14 }, (_, i) => todayStr(i)).map((d) => (
            <button key={d} className="btn-secondary" onClick={() => planFor && plan(planFor, d)}>
              {fmtDate(d, { weekday: "short", day: "numeric", month: "short" })}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

function Plan() {
  const qc = useQueryClient();
  const toast = useToast();
  const days = Array.from({ length: 7 }, (_, i) => todayStr(i));
  const q = useQuery({
    queryKey: ["outfits", "plan", days[0]],
    queryFn: () => api.get<{ outfits: OutfitDTO[] }>(`/api/outfits?from=${days[0]}&to=${days[6]}`).then((r) => r.outfits),
  });
  const [suggestFor, setSuggestFor] = useState<string | null>(null);
  const sugg = useQuery({
    queryKey: ["suggest", "plan", suggestFor],
    queryFn: () => api.post<SuggestResponse>("/api/outfits/suggest", { occasion: "work", date: suggestFor, count: 3 }),
    enabled: !!suggestFor,
    staleTime: Infinity,
  });
  const byDay = new Map<string, OutfitDTO>();
  q.data?.forEach((o) => o.plannedFor && byDay.set(o.plannedFor, o));

  const unplan = async (o: OutfitDTO) => {
    await api.patch(`/api/outfits/${o.id}`, { plannedFor: null });
    qc.invalidateQueries({ queryKey: ["outfits"] });
  };
  const choose = async (itemIds: string[], title: string, explanation: string) => {
    await api.post("/api/outfits", { itemIds, name: title, explanation, source: "ai", plannedFor: suggestFor, saved: true });
    qc.invalidateQueries({ queryKey: ["outfits"] });
    toast("Plana eklendi");
    setSuggestFor(null);
  };

  if (q.isLoading) return <PageLoader />;
  return (
    <div className="space-y-3">
      {days.map((d, i) => {
        const o = byDay.get(d);
        return (
          <div key={d} className="card flex items-center gap-3 p-3">
            <div className="w-14 shrink-0 text-center">
              <p className="text-xs text-stone-500">{i === 0 ? "Bugün" : i === 1 ? "Yarın" : fmtDate(d, { weekday: "short" })}</p>
              <p className="font-display text-2xl">{new Date(d + "T12:00").getDate()}</p>
            </div>
            {o ? (
              <>
                <Collage items={o.items} className="w-20 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{o.name || "Kombin"}</p>
                  <p className="truncate text-xs text-stone-500">{o.items.length} parça</p>
                </div>
                <button onClick={() => unplan(o)} className="btn-ghost px-2" aria-label="Plandan çıkar"><X className="h-4 w-4" /></button>
              </>
            ) : (
              <button onClick={() => setSuggestFor(d)} className="flex flex-1 items-center gap-2 rounded-xl border border-dashed border-stone-300 px-3 py-4 text-sm text-stone-500">
                <Sparkles className="h-4 w-4" /> Bu gün için kombin öner
              </button>
            )}
          </div>
        );
      })}
      <Sheet open={!!suggestFor} onClose={() => setSuggestFor(null)} title={suggestFor ? fmtDate(suggestFor, { weekday: "long", day: "numeric", month: "long" }) : ""}>
        {sugg.isLoading ? (
          <div className="flex h-60 items-center justify-center"><Spinner className="h-7 w-7" /></div>
        ) : (
          <div className="space-y-4">
            {sugg.data?.weather && <p className="text-sm text-stone-500">Tahmin: {sugg.data.weather.condition}, {sugg.data.weather.minC}°–{sugg.data.weather.maxC}°</p>}
            {(sugg.data?.suggestions ?? []).map((s) => (
              <div key={s.itemIds.join()} className="card overflow-hidden">
                <Collage items={s.items} className="rounded-none" />
                <div className="p-3">
                  <p className="font-medium">{s.title}</p>
                  <p className="text-sm text-stone-600">{s.explanation}</p>
                  <button className="btn-primary mt-3 w-full" onClick={() => choose(s.itemIds, s.title, s.explanation)}>Bunu planla</button>
                </div>
              </div>
            ))}
            {!sugg.data?.suggestions.length && <p className="text-sm text-stone-500">Öneri bulunamadı. Gardırobuna parça eklemeyi dene.</p>}
          </div>
        )}
      </Sheet>
    </div>
  );
}

function History() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["wear"],
    queryFn: () => api.get<{ logs: { id: string; date: string; items: ItemDTO[] }[] }>("/api/wear").then((r) => r.logs),
  });
  if (q.isLoading) return <PageLoader />;
  if (!q.data?.length) return <Empty icon={<Layers className="h-7 w-7" />} title="Henüz giyim kaydı yok" text="Bir öneriyi giydiğinde 'Giydim' butonuna bas; tekrarları önlemek için kullanılır." />;
  const undo = async (id: string) => {
    await api.del(`/api/wear/${id}`);
    qc.invalidateQueries({ queryKey: ["wear"] });
    qc.invalidateQueries({ queryKey: ["items"] });
  };
  return (
    <div className="space-y-3">
      {q.data.map((l) => (
        <div key={l.id} className="card flex items-center gap-3 p-3">
          <Collage items={l.items} className="w-20 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">{fmtDate(l.date, { weekday: "long", day: "numeric", month: "long" })}</p>
            <p className="text-xs text-stone-500">{l.items.length} parça</p>
          </div>
          <button onClick={() => undo(l.id)} className="btn-ghost px-2 text-xs" aria-label="Geri al"><Undo2 className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  );
}

