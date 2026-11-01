import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck, Check, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import type { Occasion, OutfitDTO, SuggestionDTO, WeatherDTO } from "@fashionos/shared";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { Collage } from "./Collage";
import { itemTitle } from "./ItemCard";
import { useToast } from "./ui";

/** Öneri kartı: kolaj + açıklama + geri bildirim butonları */
export function SuggestionCard({
  s,
  occasion,
  weather,
  onDislike,
  date,
}: {
  s: SuggestionDTO;
  occasion: Occasion;
  weather: WeatherDTO | null;
  onDislike?: () => void;
  date?: string;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [outfit, setOutfit] = useState<OutfitDTO | null>(null);
  const [state, setState] = useState<{ rating: -1 | 0 | 1; saved: boolean; worn: boolean }>({ rating: 0, saved: false, worn: false });
  const [busy, setBusy] = useState(false);

  const ensure = async (extra: Record<string, unknown> = {}) => {
    const r = await api.post<{ outfit: OutfitDTO }>("/api/outfits", {
      itemIds: s.itemIds,
      name: s.title,
      occasion,
      source: s.source,
      explanation: s.explanation,
      score: s.score,
      saved: false,
      weather: weather ? { tempC: weather.tempC, feelsC: weather.feelsC, condition: weather.condition, precipitation: weather.precipitation } : undefined,
      ...extra,
    });
    setOutfit(r.outfit);
    return r.outfit;
  };

  const act = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      qc.invalidateQueries({ queryKey: ["outfits"] });
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const rate = (rating: -1 | 1) =>
    act(async () => {
      const o = outfit ?? (await ensure());
      const next = state.rating === rating ? 0 : rating;
      await api.patch(`/api/outfits/${o.id}`, { rating: next });
      setState((st) => ({ ...st, rating: next }));
      if (next === -1) {
        toast("Anlaşıldı, bu kombini bir daha önermeyeceğim.");
        onDislike?.();
      } else if (next === 1) toast("Not aldım, buna benzer kombinleri daha sık önereceğim.");
    });

  const save = () =>
    act(async () => {
      const o = outfit ?? (await ensure());
      await api.patch(`/api/outfits/${o.id}`, { saved: !state.saved });
      setState((st) => ({ ...st, saved: !st.saved }));
      toast(state.saved ? "Kayıtlardan çıkarıldı" : "Kombinlerime kaydedildi");
    });

  const wear = () =>
    act(async () => {
      const o = outfit ?? (await ensure());
      await api.post("/api/wear", { itemIds: s.itemIds, outfitId: o.id, ...(date ? { date } : {}) });
      setState((st) => ({ ...st, worn: true }));
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["wear"] });
      toast("Harika! Giyim geçmişine eklendi.");
    });

  return (
    <article className="card w-full shrink-0 snap-center overflow-hidden">
      <Collage items={s.items} className="rounded-none" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg leading-snug">{s.title}</h3>
          {s.source === "ai" && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
              <Sparkles className="h-3 w-3" /> Stilist
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-stone-600">{s.explanation}</p>
        <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
          {s.items.map((i) => (
            <span key={i.id} className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600">
              {itemTitle(i)}
            </span>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          <button onClick={() => rate(1)} className={cn("btn-secondary px-0", state.rating === 1 && "bg-green-50 ring-green-300")} aria-label="Beğendim">
            <ThumbsUp className={cn("h-5 w-5", state.rating === 1 && "fill-green-600 text-green-600")} />
          </button>
          <button onClick={() => rate(-1)} className={cn("btn-secondary px-0", state.rating === -1 && "bg-red-50 ring-red-300")} aria-label="Beğenmedim">
            <ThumbsDown className={cn("h-5 w-5", state.rating === -1 && "fill-red-600 text-red-600")} />
          </button>
          <button onClick={save} className="btn-secondary px-0" aria-label="Kaydet">
            {state.saved ? <BookmarkCheck className="h-5 w-5 fill-ink" /> : <Bookmark className="h-5 w-5" />}
          </button>
          <button onClick={wear} disabled={state.worn} className="btn-primary px-0" aria-label="Bunu giydim">
            {state.worn ? <Check className="h-5 w-5" /> : "Giydim"}
          </button>
        </div>
      </div>
    </article>
  );
}
