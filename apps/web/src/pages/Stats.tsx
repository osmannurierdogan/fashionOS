import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3 } from "lucide-react";
import { CATEGORIES, type StatsDTO } from "@fashionos/shared";
import { api } from "../lib/api";
import { fmtMoney } from "../lib/utils";
import { Empty, PageHeader, PageLoader } from "../components/ui";
import { ItemCard } from "../components/ItemCard";

export default function Stats() {
  const q = useQuery({ queryKey: ["stats"], queryFn: () => api.get<StatsDTO>("/api/stats") });
  if (q.isLoading) return <PageLoader />;
  const s = q.data;
  if (!s || !s.totalItems) return <Empty icon={<BarChart3 className="h-7 w-7" />} title="Analiz için parça ekle" action={<Link to="/add" className="btn-primary">Parça ekle</Link>} />;
  const maxCat = Math.max(...Object.values(s.byCategory));
  const totalColor = s.byColor.reduce((a, c) => a + c.count, 0);

  return (
    <div className="pb-8">
      <PageHeader title="Gardırop analizi" />
      <div className="space-y-6 px-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-3"><p className="text-2xl font-semibold">{s.totalItems}</p><p className="text-xs text-stone-500">parça</p></div>
          <div className="card p-3"><p className="text-2xl font-semibold">{s.wearsLast30Days}</p><p className="text-xs text-stone-500">giyim / 30 gün</p></div>
          <div className="card p-3"><p className="text-lg font-semibold leading-8">{s.totalValue ? fmtMoney(s.totalValue) : "—"}</p><p className="text-xs text-stone-500">toplam değer</p></div>
        </div>

        {s.gaps.length > 0 && (
          <section className="card p-4">
            <h2 className="mb-2 flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4 text-accent" /> Eksik temel parçalar</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-stone-600">{s.gaps.map((g) => <li key={g}>{g}</li>)}</ul>
          </section>
        )}

        <section className="card p-4">
          <h2 className="mb-3 font-medium">Kategoriler</h2>
          <div className="space-y-2">
            {Object.entries(s.byCategory).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
              <div key={k} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 text-stone-600">{CATEGORIES[k as keyof typeof CATEGORIES]?.label ?? k}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-ink" style={{ width: `${(n / maxCat) * 100}%` }} /></div>
                <span className="w-8 text-right tabular-nums">{n}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-4">
          <h2 className="mb-3 font-medium">Renk paleti</h2>
          <div className="flex h-6 overflow-hidden rounded-full ring-1 ring-black/5">
            {s.byColor.map((c) => <div key={c.key} title={`${c.name}: ${c.count}`} style={{ background: c.hex, width: `${(c.count / totalColor) * 100}%` }} />)}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {s.byColor.slice(0, 10).map((c) => (
              <span key={c.key} className="chip text-xs"><span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: c.hex }} />{c.name} · {c.count}</span>
            ))}
          </div>
        </section>

        {s.neverWorn.length > 0 && (
          <section>
            <h2 className="mb-1 font-medium">Hiç giymediklerin</h2>
            <p className="mb-3 text-xs text-stone-500">Bunlara şans ver ya da bağışlamayı düşün.</p>
            <div className="grid grid-cols-3 gap-3">{s.neverWorn.slice(0, 9).map((i) => <ItemCard key={i.id} item={i} to={`/items/${i.id}`} />)}</div>
          </section>
        )}
        {s.mostWorn.length > 0 && (
          <section>
            <h2 className="mb-3 font-medium">En çok giydiklerin</h2>
            <div className="grid grid-cols-3 gap-3">{s.mostWorn.slice(0, 6).map((i) => <ItemCard key={i.id} item={i} to={`/items/${i.id}`} />)}</div>
          </section>
        )}
        {s.costPerWear.length > 0 && (
          <section className="card p-4">
            <h2 className="mb-2 font-medium">Giyim başı maliyet</h2>
            <div className="divide-y divide-stone-100">
              {s.costPerWear.map(({ item, cpw }) => (
                <Link key={item.id} to={`/items/${item.id}`} className="flex items-center gap-3 py-2 text-sm">
                  <img src={item.image.thumbUrl} alt="" className="h-10 w-10 rounded-lg bg-stone-100 object-contain" />
                  <span className="flex-1 truncate">{item.name || item.subcategory}</span>
                  <span className="tabular-nums">{fmtMoney(cpw)}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
