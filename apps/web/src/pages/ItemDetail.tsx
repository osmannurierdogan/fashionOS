import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArrowLeft, Heart, Sparkles, Trash2, Camera } from "lucide-react";
import { CATEGORIES, FORMALITY_LABELS, MATERIALS, PATTERNS, SEASONS, STYLES, WARMTH_LABELS, subcategoryLabel, type ItemDTO } from "@fashionos/shared";
import { api } from "../lib/api";
import { downscale, removeBg } from "../lib/image";
import { fmtMoney, relDays } from "../lib/utils";
import { ItemForm, type ItemFormValue } from "../components/ItemForm";
import { itemTitle } from "../components/ItemCard";
import { PageLoader, Sheet, Spinner, useToast } from "../components/ui";

const toForm = (i: ItemDTO): ItemFormValue => ({
  name: i.name, category: i.category, subcategory: i.subcategory, colors: i.colors, pattern: i.pattern, material: i.material,
  seasons: i.seasons, warmth: i.warmth, formality: i.formality, styles: i.styles, layer: i.layer, waterproof: i.waterproof,
  brand: i.brand, size: i.size, price: i.price, notes: i.notes, favorite: i.favorite,
});

export default function ItemDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["items", "one", id], queryFn: () => api.get<{ item: ItemDTO }>(`/api/items/${id}`).then((r) => r.item) });
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<ItemFormValue | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  useEffect(() => { if (q.data) setForm(toForm(q.data)); }, [q.data]);

  if (q.isLoading || !form) return <PageLoader />;
  if (!q.data) return <p className="p-6">Parça bulunamadı.</p>;
  const it = q.data;

  const update = async (body: Record<string, unknown>, msg = "Kaydedildi") => {
    setBusy(true);
    try {
      const r = await api.patch<{ item: ItemDTO }>(`/api/items/${it.id}`, body);
      qc.setQueryData(["items", "one", id], r.item);
      qc.invalidateQueries({ queryKey: ["items"] });
      toast(msg);
      setEdit(false);
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const replacePhoto = async (file: File) => {
    setBusy(true);
    try {
      const small = await downscale(file);
      let cut: Blob | null = null;
      try { cut = await removeBg(small); } catch { /* orijinal kullanılır */ }
      const fd = new FormData();
      fd.append("cutout", cut ? "true" : "false");
      fd.append("image", cut ?? small, "image.png");
      fd.append("original", small, "original.jpg");
      const r = await api.put<{ item: ItemDTO }>(`/api/items/${it.id}/image`, fd);
      qc.setQueryData(["items", "one", id], r.item);
      qc.invalidateQueries({ queryKey: ["items"] });
      toast("Fotoğraf güncellendi");
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    await api.del(`/api/items/${it.id}`);
    qc.invalidateQueries({ queryKey: ["items"] });
    qc.invalidateQueries({ queryKey: ["me"] });
    toast("Parça silindi");
    nav("/wardrobe", { replace: true });
  };

  const Row = ({ k, v }: { k: string; v: string }) => (v ? <div className="flex justify-between py-2 text-sm"><span className="text-stone-500">{k}</span><span className="text-right">{v}</span></div> : null);

  return (
    <div className="pb-8">
      <div className="flex items-center justify-between px-4 pt-4">
        <button onClick={() => nav(-1)} className="btn-ghost px-2" aria-label="Geri"><ArrowLeft className="h-5 w-5" /></button>
        <div className="flex gap-1">
          <button onClick={() => update({ favorite: !it.favorite }, it.favorite ? "Favorilerden çıkarıldı" : "Favorilere eklendi")} className="btn-ghost px-2" aria-label="Favori">
            <Heart className={it.favorite ? "h-5 w-5 fill-rose-500 text-rose-500" : "h-5 w-5"} />
          </button>
          <button onClick={() => update({ archived: !it.archived }, it.archived ? "Arşivden çıkarıldı" : "Arşivlendi; artık önerilmeyecek")} className="btn-ghost px-2" aria-label="Arşivle">
            <Archive className="h-5 w-5" />
          </button>
          <button onClick={() => setConfirmDel(true)} className="btn-ghost px-2 text-red-600" aria-label="Sil"><Trash2 className="h-5 w-5" /></button>
        </div>
      </div>

      <div className="checker relative mx-4 mt-2 aspect-square overflow-hidden rounded-3xl">
        <img src={it.image.url} alt={itemTitle(it)} className="h-full w-full object-contain p-4" />
        <label className="btn-secondary absolute right-3 bottom-3 cursor-pointer px-3 text-xs">
          {busy ? <Spinner className="h-4 w-4" /> : <Camera className="h-4 w-4" />} Fotoğrafı değiştir
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && replacePhoto(e.target.files[0])} />
        </label>
      </div>

      <div className="px-4 pt-4">
        <h1 className="font-display text-2xl">{itemTitle(it)}</h1>
        <p className="text-sm text-stone-500">
          {CATEGORIES[it.category].label} · {subcategoryLabel(it.category, it.subcategory)} · {it.wearCount} kez giyildi · {relDays(it.lastWornAt)}
        </p>
        {it.archived && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Bu parça arşivde; kombin önerilerinde kullanılmaz.</p>}

        <Link to={`/stylist?with=${it.id}`} className="btn-primary mt-4 w-full">
          <Sparkles className="h-4 w-4" /> Bu parçayla kombin öner
        </Link>

        {!edit ? (
          <div className="card mt-4 divide-y divide-stone-100 px-4">
            <div className="flex items-center gap-2 py-3">
              {it.colors.map((c) => (
                <span key={c.hex} className="chip"><span className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ background: c.hex }} />{c.name}</span>
              ))}
            </div>
            <Row k="Desen" v={PATTERNS[it.pattern]} />
            <Row k="Kumaş" v={MATERIALS[it.material]} />
            <Row k="Mevsim" v={it.seasons.map((s) => SEASONS[s]).join(", ")} />
            <Row k="Kalınlık" v={WARMTH_LABELS[it.warmth] ?? ""} />
            <Row k="Resmiyet" v={FORMALITY_LABELS[it.formality] ?? ""} />
            <Row k="Stil" v={it.styles.map((s) => STYLES[s]).join(", ")} />
            <Row k="Su geçirmez" v={it.waterproof ? "Evet" : ""} />
            <Row k="Marka" v={it.brand} />
            <Row k="Beden" v={it.size} />
            <Row k="Fiyat" v={it.price ? fmtMoney(it.price) : ""} />
            <Row k="Giyim başı maliyet" v={it.price ? fmtMoney(it.price / Math.max(1, it.wearCount)) : ""} />
            <Row k="Not" v={it.notes} />
            <div className="py-3">
              <button className="btn-secondary w-full" onClick={() => setEdit(true)}>Bilgileri düzenle</button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <ItemForm value={form} onChange={setForm} />
            <div className="sticky bottom-20 mt-6 flex gap-2 bg-paper/90 py-2 backdrop-blur">
              <button className="btn-secondary flex-1" onClick={() => { setForm(toForm(it)); setEdit(false); }}>Vazgeç</button>
              <button className="btn-primary flex-1" disabled={busy || !form.colors.length} onClick={() => update({ ...form })}>Kaydet</button>
            </div>
          </div>
        )}
      </div>

      <Sheet open={confirmDel} onClose={() => setConfirmDel(false)} title="Parçayı sil">
        <p className="text-sm text-stone-600">Bu parça ve fotoğrafları kalıcı olarak silinecek; kayıtlı kombinlerden de çıkarılacak. Sadece önerilerde görünmesin istiyorsan arşivleyebilirsin.</p>
        <div className="mt-5 flex gap-2">
          <button className="btn-secondary flex-1" onClick={() => { setConfirmDel(false); update({ archived: true }, "Arşivlendi"); }}>Arşivle</button>
          <button className="btn-danger flex-1" onClick={remove}>Kalıcı olarak sil</button>
        </div>
      </Sheet>
    </div>
  );
}
