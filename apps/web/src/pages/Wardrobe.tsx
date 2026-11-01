import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, Shirt, Plus } from "lucide-react";
import { CATEGORIES, PALETTE, SEASONS, STYLES, type ItemDTO } from "@fashionos/shared";
import { api, qs } from "../lib/api";
import { cn } from "../lib/utils";
import { Chips, Empty, PageHeader, PageLoader, Sheet } from "../components/ui";
import { ItemCard } from "../components/ItemCard";

const SORTS = { newest: "En yeni", oldest: "En eski", most_worn: "En çok giyilen", least_worn: "En az giyilen" };

export function Wardrobe() {
  const [category, setCategory] = useState<string>("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ season: "", color: "", style: "", favorite: false, sort: "newest", archived: false });
  const params = { category, q, season: f.season, color: f.color, style: f.style, favorite: f.favorite || undefined, sort: f.sort, archived: f.archived || undefined };
  const items = useQuery({
    queryKey: ["items", params],
    queryFn: () => api.get<{ items: ItemDTO[] }>(`/api/items${qs(params)}`).then((r) => r.items),
    placeholderData: (prev) => prev,
  });
  const activeFilters = [f.season, f.color, f.style, f.favorite, f.archived].filter(Boolean).length;

  return (
    <div>
      <PageHeader
        title="Gardırop"
        subtitle={items.data ? `${items.data.length} parça` : undefined}
        right={<Link to="/add" className="btn-primary px-3"><Plus className="h-4 w-4" /> Ekle</Link>}
      />
      <div className="px-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input className="input pl-9" placeholder="Ad, marka veya not ara" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className={cn("btn-secondary relative px-3", activeFilters && "ring-ink")} onClick={() => setOpen(true)} aria-label="Filtreler">
            <SlidersHorizontal className="h-4 w-4" />
            {activeFilters > 0 && <span className="absolute -top-1 -right-1 rounded-full bg-ink px-1.5 text-[10px] text-paper">{activeFilters}</span>}
          </button>
        </div>
        <Chips
          scroll
          className="mt-3"
          options={[["", "Tümü"], ...Object.entries(CATEGORIES).map(([k, c]) => [k, c.label] as [string, string])]}
          value={category}
          onChange={setCategory}
        />
      </div>

      <div className="px-4 pt-4">
        {items.isLoading ? (
          <PageLoader />
        ) : !items.data?.length ? (
          <Empty
            icon={<Shirt className="h-7 w-7" />}
            title={q || category || activeFilters ? "Sonuç yok" : "Henüz parça eklemedin"}
            text={q || category || activeFilters ? "Filtreleri değiştirmeyi dene." : "Kıyafetlerini ve aksesuarlarını fotoğraflayarak başla."}
            action={!q && !category && !activeFilters ? <Link to="/add" className="btn-primary">İlk parçayı ekle</Link> : undefined}
          />
        ) : (
          <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4">
            {items.data.map((i) => <ItemCard key={i.id} item={i} to={`/items/${i.id}`} />)}
          </div>
        )}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Filtrele">
        <div className="space-y-5">
          <div>
            <span className="label">Sırala</span>
            <Chips options={SORTS} value={f.sort} onChange={(v: string) => setF({ ...f, sort: v })} />
          </div>
          <div>
            <span className="label">Mevsim</span>
            <Chips options={[["", "Hepsi"], ...Object.entries(SEASONS)] as [string, string][]} value={f.season} onChange={(v: string) => setF({ ...f, season: v })} />
          </div>
          <div>
            <span className="label">Stil</span>
            <Chips options={[["", "Hepsi"], ...Object.entries(STYLES)] as [string, string][]} value={f.style} onChange={(v: string) => setF({ ...f, style: v })} />
          </div>
          <div>
            <span className="label">Renk</span>
            <div className="flex flex-wrap gap-2">
              {PALETTE.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setF({ ...f, color: f.color === p.key ? "" : p.key })}
                  className={cn("h-8 w-8 rounded-full ring-1 ring-black/10", f.color === p.key && "ring-2 ring-ink ring-offset-2")}
                  style={{ background: p.hex }}
                  title={p.name}
                  aria-label={p.name}
                />
              ))}
            </div>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-ink" checked={f.favorite} onChange={(e) => setF({ ...f, favorite: e.target.checked })} /> Sadece favoriler
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-ink" checked={f.archived} onChange={(e) => setF({ ...f, archived: e.target.checked })} /> Arşivlenmiş parçaları göster
          </label>
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setF({ season: "", color: "", style: "", favorite: false, sort: "newest", archived: false })}>Temizle</button>
            <button className="btn-primary flex-1" onClick={() => setOpen(false)}>Uygula</button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
