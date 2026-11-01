import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Shirt, Sparkles, Luggage, BarChart3, Wand2 } from "lucide-react";
import { OCCASIONS, CATEGORIES, type Occasion, type OutfitDTO, type SuggestResponse, type WeatherDTO } from "@fashionos/shared";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { todayStr } from "../lib/utils";
import { Chips, Empty, Spinner } from "../components/ui";
import { SuggestionCard } from "../components/SuggestionCard";
import { WeatherCard } from "../components/Weather";
import { Collage } from "../components/Collage";

const greeting = () => {
  const h = new Date().getHours();
  return h < 6 ? "İyi geceler" : h < 12 ? "Günaydın" : h < 18 ? "İyi günler" : "İyi akşamlar";
};

const MISSING_TEXT: Record<string, string> = {
  top: "üst giyim",
  bottom: "alt giyim",
  shoes: "ayakkabı",
  outerwear: "bu hava için bir mont/ceket",
};

export function Today() {
  const { user } = useAuth();
  const [occasion, setOccasion] = useState<Occasion>(() => (localStorage.getItem("fos_occasion") as Occasion) || "daily");
  const [nonce, setNonce] = useState(0);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  useEffect(() => {
    try { localStorage.setItem("fos_occasion", occasion); } catch { /* yok say */ }
  }, [occasion]);

  const weather = useQuery({
    queryKey: ["weather"],
    queryFn: () => api.get<{ forecast: WeatherDTO[]; city: string | null }>("/api/weather?days=1"),
    staleTime: 30 * 60_000,
  });
  const planned = useQuery({
    queryKey: ["outfits", "planned", todayStr()],
    queryFn: () => api.get<{ outfits: OutfitDTO[] }>(`/api/outfits?from=${todayStr()}&to=${todayStr()}`),
  });
  const sugg = useQuery({
    queryKey: ["suggest", occasion, nonce],
    queryFn: () => api.post<SuggestResponse>("/api/outfits/suggest", { occasion, count: 3 }),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });

  const w = sugg.data?.weather ?? weather.data?.forecast?.[0] ?? null;
  const list = (sugg.data?.suggestions ?? []).filter((s) => !hidden.has(s.itemIds.join()));
  const noItems = (user?.itemCount ?? 0) === 0;

  return (
    <div className="px-4">
      <div className="pt-6 pb-4">
        <p className="text-sm text-stone-500">{new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="font-display text-[28px] leading-tight">{greeting()}, {user?.name.split(" ")[0]}</h1>
      </div>

      {w && <WeatherCard w={w} city={weather.data?.city ?? user?.profile.city} />}

      {planned.data?.outfits?.[0] && (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-medium text-stone-500">Bugün için planladığın</h2>
          <div className="card flex items-center gap-3 p-3">
            <Collage items={planned.data.outfits[0].items} className="w-24 shrink-0" />
            <div>
              <p className="font-medium">{planned.data.outfits[0].name || "Planlı kombin"}</p>
              <Link to="/outfits" className="text-sm text-stone-500 underline">Kombinlerimde gör</Link>
            </div>
          </div>
        </section>
      )}

      {noItems ? (
        <Empty
          icon={<Shirt className="h-7 w-7" />}
          title="Gardırobun boş"
          text="Kombin önerebilmem için en az birkaç üst, alt ve bir ayakkabı ekle."
          action={<Link to="/add" className="btn-primary">Parça ekle</Link>}
        />
      ) : (
        <>
          <div className="mt-6 mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl">Bugün ne giysem?</h2>
            <button className="btn-ghost px-2" onClick={() => { setHidden(new Set()); setNonce((n) => n + 1); }} disabled={sugg.isFetching}>
              <RefreshCw className={sugg.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Başka öner
            </button>
          </div>
          <Chips scroll options={OCCASIONS} value={occasion} onChange={(o: Occasion) => setOccasion(o)} />

          <div className="mt-4">
            {sugg.isLoading || (sugg.isFetching && !list.length) ? (
              <div className="card flex h-80 flex-col items-center justify-center gap-3 text-sm text-stone-500">
                <Spinner className="h-7 w-7" />
                Gardırobuna bakıyorum…
              </div>
            ) : sugg.error ? (
              <p className="card p-4 text-sm text-red-700">{(sugg.error as Error).message}</p>
            ) : list.length ? (
              <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
                {list.map((s) => (
                  <div key={s.itemIds.join()} className="w-[86%] shrink-0 snap-center sm:w-[70%]">
                    <SuggestionCard
                      s={s}
                      occasion={occasion}
                      weather={sugg.data?.weather ?? null}
                      onDislike={() => setHidden((h) => new Set([...h, s.itemIds.join()]))}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                icon={<Shirt className="h-7 w-7" />}
                title="Bu koşullara uygun kombin bulamadım"
                text={
                  sugg.data?.missing?.length
                    ? `Eksik: ${sugg.data.missing.map((m) => MISSING_TEXT[m] ?? CATEGORIES[m as keyof typeof CATEGORIES]?.label ?? m).join(", ")}.`
                    : "Farklı bir etkinlik seç veya gardırobuna parça ekle."
                }
                action={<Link to="/add" className="btn-primary">Parça ekle</Link>}
              />
            )}
            {sugg.data?.missing?.length && list.length ? (
              <p className="mt-2 text-xs text-stone-500">
                İpucu: Gardırobunda {sugg.data.missing.map((m) => MISSING_TEXT[m] ?? m).join(", ")} yok; eklersen öneriler daha isabetli olur.
              </p>
            ) : null}
          </div>
        </>
      )}

      <section className="mt-8 grid grid-cols-2 gap-3 pb-6">
        <Link to="/stylist" className="card p-4">
          <Wand2 className="h-5 w-5 text-accent" />
          <p className="mt-2 font-medium">Stiliste sor</p>
          <p className="text-xs text-stone-500">Etkinlik veya parça seç</p>
        </Link>
        <Link to="/packing" className="card p-4">
          <Luggage className="h-5 w-5 text-accent" />
          <p className="mt-2 font-medium">Valiz hazırla</p>
          <p className="text-xs text-stone-500">Seyahat kombinleri</p>
        </Link>
        <Link to="/stats" className="card p-4">
          <BarChart3 className="h-5 w-5 text-accent" />
          <p className="mt-2 font-medium">Gardırop analizi</p>
          <p className="text-xs text-stone-500">Eksikler, istatistikler</p>
        </Link>
        <Link to="/outfits" className="card p-4">
          <Sparkles className="h-5 w-5 text-accent" />
          <p className="mt-2 font-medium">Haftalık plan</p>
          <p className="text-xs text-stone-500">Kombin takvimi</p>
        </Link>
      </section>
    </div>
  );
}
