import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Camera, Check, ImagePlus, Lightbulb, Sparkles, Trash2, Wand2 } from "lucide-react";
import type { AiTag, ItemDTO } from "@fashionos/shared";
import { api, ApiError } from "../lib/api";
import { cutout as makeCutout, downscale, extractColors, preloadBgModel } from "../lib/image";
import { cn } from "../lib/utils";
import { ItemForm, emptyItem, type ItemFormValue } from "../components/ItemForm";
import { PageHeader, Spinner, useToast } from "../components/ui";

type Status = "queued" | "processing" | "ready" | "saving" | "saved" | "error";

interface Draft {
  id: string;
  original: Blob; // küçültülmüş orijinal
  cutout: Blob | null; // arka plansız PNG
  useCutout: boolean;
  previewOriginal: string;
  previewCutout: string | null;
  status: Status;
  stage: string;
  progress: number;
  ai: boolean;
  form: ItemFormValue;
  error?: string;
}

const uid = () => Math.random().toString(36).slice(2);

function applyTag(form: ItemFormValue, tag: AiTag): ItemFormValue {
  return {
    ...form,
    name: tag.name || form.name,
    category: tag.category as ItemFormValue["category"],
    subcategory: tag.subcategory,
    pattern: tag.pattern,
    material: tag.material,
    seasons: tag.seasons,
    warmth: tag.warmth,
    formality: tag.formality,
    styles: tag.styles,
    layer: tag.layer,
    waterproof: tag.waterproof,
    // Piksel tabanlı renkler daha isabetli; yoksa modelin renkleri
    colors: form.colors.length ? form.colors : tag.colors,
  };
}

export default function AddItems() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const processing = useRef(false);
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  useEffect(() => {
    preloadBgModel();
    return () => draftsRef.current.forEach((d) => { URL.revokeObjectURL(d.previewOriginal); if (d.previewCutout) URL.revokeObjectURL(d.previewCutout); });
  }, []);

  const patch = (id: string, p: Partial<Draft> | ((d: Draft) => Partial<Draft>)) =>
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...(typeof p === "function" ? p(d) : p) } : d)));

  // Sıradaki taslakları tek tek işle (tarayıcıyı kilitlememek için sırayla)
  useEffect(() => {
    if (processing.current) return;
    const next = drafts.find((d) => d.status === "queued");
    if (!next) return;
    processing.current = true;
    (async () => {
      const id = next.id;
      patch(id, { status: "processing", stage: "Hazırlanıyor", progress: 0 });
      const cutout = await makeCutout(next.original, (pct, stage) => patch(id, { progress: pct, stage }));
      if (cutout) patch(id, { cutout, previewCutout: URL.createObjectURL(cutout), useCutout: true });
      else patch(id, { stage: "Arka plan silinemedi, orijinal kullanılacak" });
      const source = cutout ?? next.original;
      patch(id, { stage: "Renkler çıkarılıyor" });
      const colors = await extractColors(source).catch(() => []);
      patch(id, (d) => ({ form: { ...d.form, colors: colors.map((c) => ({ hex: c.hex, name: c.name, ratio: c.ratio })) } }));
      patch(id, { stage: "Yapay zekâ inceliyor" });
      try {
        const fd = new FormData();
        fd.append("image", source, "image.png");
        const r = await api.post<{ tag: AiTag | null; ai: boolean; error?: string }>("/api/ai/tag", fd);
        if (r.tag) patch(id, (d) => ({ form: applyTag(d.form, r.tag!), ai: true }));
      } catch (e) {
        if (e instanceof ApiError && e.status === 402) toast(e.message, "err");
      }
      patch(id, { status: "ready", stage: "", progress: 100 });
      setActiveId((a) => a ?? id);
      processing.current = false;
      setDrafts((ds) => [...ds]); // sıradakini tetikle
    })();
  }, [drafts]); // eslint-disable-line react-hooks/exhaustive-deps

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, 30);
    const created: Draft[] = [];
    for (const f of list) {
      const small = await downscale(f, 1600);
      created.push({
        id: uid(),
        original: small,
        cutout: null,
        useCutout: false,
        previewOriginal: URL.createObjectURL(small),
        previewCutout: null,
        status: "queued",
        stage: "Sırada",
        progress: 0,
        ai: false,
        form: emptyItem(),
      });
    }
    setDrafts((d) => [...d, ...created]);
    setActiveId((a) => a ?? created[0]!.id);
  };

  const save = async (d: Draft) => {
    if (!d.form.colors.length) {
      toast("En az bir renk seç", "err");
      setActiveId(d.id);
      return false;
    }
    patch(d.id, { status: "saving" });
    try {
      const fd = new FormData();
      const useCut = d.useCutout && d.cutout;
      fd.append("data", JSON.stringify({ ...d.form, aiTagged: d.ai }));
      fd.append("cutout", useCut ? "true" : "false");
      fd.append("image", useCut ? d.cutout! : d.original, useCut ? "cutout.png" : "image.jpg");
      if (useCut) fd.append("original", d.original, "original.jpg");
      await api.post<{ item: ItemDTO }>("/api/items", fd);
      patch(d.id, { status: "saved" });
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.removeQueries({ queryKey: ["suggest"] });
      return true;
    } catch (e) {
      patch(d.id, { status: "ready", error: (e as Error).message });
      toast((e as Error).message, "err");
      return false;
    }
  };

  const saveActive = async () => {
    const d = drafts.find((x) => x.id === activeId);
    if (!d) return;
    if (await save(d)) {
      toast("Gardırobuna eklendi");
      const next = drafts.find((x) => x.id !== d.id && (x.status === "ready" || x.status === "processing" || x.status === "queued"));
      setActiveId(next?.id ?? null);
    }
  };

  const saveAll = async () => {
    let ok = 0;
    for (const d of drafts.filter((x) => x.status === "ready")) if (await save(d)) ok++;
    if (ok) toast(`${ok} parça eklendi`);
  };

  const remove = (id: string) => {
    setDrafts((ds) => ds.filter((d) => d.id !== id));
    if (activeId === id) setActiveId(drafts.find((d) => d.id !== id && d.status !== "saved")?.id ?? null);
  };

  const active = drafts.find((d) => d.id === activeId) ?? null;
  const pending = drafts.filter((d) => d.status !== "saved");
  const readyCount = drafts.filter((d) => d.status === "ready").length;
  const savedCount = drafts.filter((d) => d.status === "saved").length;

  return (
    <div className="pb-8">
      <PageHeader title="Parça ekle" subtitle="Kıyafet veya aksesuar fotoğrafla" />
      <div className="px-4">
        {params.get("first") && !drafts.length && (
          <div className="card mb-4 flex gap-3 p-4 text-sm">
            <Lightbulb className="h-5 w-5 shrink-0 text-accent" />
            <p>
              Hoş geldin! İlk öneriler için en az <b>3 üst, 2 alt ve 1 ayakkabı</b> ekle. Parçayı düz bir zemine (yatak, yer) serip
              yukarıdan çekersen arka plan en temiz şekilde silinir. Beyaz parçaları koyu, koyu parçaları açık bir zeminde çek.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="card flex cursor-pointer flex-col items-center gap-2 p-5 text-sm font-medium">
            <Camera className="h-7 w-7 text-accent" /> Fotoğraf çek
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </label>
          <label className="card flex cursor-pointer flex-col items-center gap-2 p-5 text-sm font-medium">
            <ImagePlus className="h-7 w-7 text-accent" /> Galeriden seç
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </label>
        </div>

        {drafts.length > 0 && (
          <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {drafts.map((d) => (
              <button
                key={d.id}
                onClick={() => d.status !== "saved" && setActiveId(d.id)}
                className={cn("checker relative h-20 w-20 shrink-0 overflow-hidden rounded-xl ring-2", d.id === activeId ? "ring-ink" : "ring-transparent")}
              >
                <img src={(d.useCutout && d.previewCutout) || d.previewOriginal} alt="" className="h-full w-full object-contain" />
                {(d.status === "processing" || d.status === "queued" || d.status === "saving") && (
                  <span className="absolute inset-0 flex items-center justify-center bg-white/60"><Spinner /></span>
                )}
                {d.status === "saved" && (
                  <span className="absolute inset-0 flex items-center justify-center bg-green-600/70 text-white"><Check className="h-6 w-6" /></span>
                )}
                {d.error && <AlertCircle className="absolute top-1 right-1 h-4 w-4 text-red-600" />}
              </button>
            ))}
          </div>
        )}

        {active && active.status !== "saved" && (
          <div className="mt-4">
            <div className="checker relative aspect-square overflow-hidden rounded-3xl">
              <img src={(active.useCutout && active.previewCutout) || active.previewOriginal} alt="Önizleme" className="h-full w-full object-contain p-3" />
              {(active.status === "processing" || active.status === "queued") && (
                <div className="absolute inset-x-4 bottom-4 rounded-xl bg-white/90 p-3 text-sm shadow">
                  <div className="flex items-center gap-2"><Wand2 className="h-4 w-4 text-accent" /> {active.stage || "Sırada"}</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200">
                    <div className="h-full bg-ink transition-all" style={{ width: `${active.progress}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-stone-500">İlk seferde model indirildiği için biraz sürebilir.</p>
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              {active.previewCutout ? (
                <div className="flex rounded-xl bg-stone-100 p-1 text-sm">
                  <button className={cn("rounded-lg px-3 py-1.5", active.useCutout && "bg-white shadow-sm")} onClick={() => patch(active.id, { useCutout: true })}>Arka plansız</button>
                  <button className={cn("rounded-lg px-3 py-1.5", !active.useCutout && "bg-white shadow-sm")} onClick={() => patch(active.id, { useCutout: false })}>Orijinal</button>
                </div>
              ) : <span />}
              <button className="btn-ghost px-2 text-red-600" onClick={() => remove(active.id)}><Trash2 className="h-4 w-4" /> Çıkar</button>
            </div>
            {active.ai && (
              <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">
                <Sparkles className="h-3.5 w-3.5" /> Bilgiler yapay zekâ ile dolduruldu, kontrol edip düzeltebilirsin.
              </p>
            )}
            <div className="mt-4">
              <ItemForm value={active.form} onChange={(form) => patch(active.id, { form })} />
            </div>
          </div>
        )}

        {drafts.length > 0 && !pending.length && (
          <div className="card mt-6 p-5 text-center">
            <Check className="mx-auto h-8 w-8 text-green-600" />
            <p className="mt-2 font-medium">{savedCount} parça gardırobuna eklendi</p>
            <div className="mt-4 flex justify-center gap-2">
              <button className="btn-secondary" onClick={() => setDrafts([])}>Daha fazla ekle</button>
              <button className="btn-primary" onClick={() => nav("/")}>Kombin öner</button>
            </div>
          </div>
        )}
        {!drafts.length && (
          <p className="mt-6 text-center text-sm text-stone-500">
            Birden fazla fotoğraf seçebilirsin; her biri sırayla işlenir. <Link to="/wardrobe" className="underline">Gardıroba dön</Link>
          </p>
        )}
      </div>

      {active && active.status !== "saved" && (
        <div className="pb-safe fixed inset-x-0 bottom-16 z-30 border-t border-stone-200 bg-paper/95 px-4 pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl gap-2">
            {readyCount > 1 && (
              <button className="btn-secondary flex-1" onClick={saveAll}>Hepsini kaydet ({readyCount})</button>
            )}
            <button className="btn-primary flex-1" disabled={active.status !== "ready" || !active.form.colors.length} onClick={saveActive}>
              {active.status === "saving" ? <Spinner className="text-paper" /> : "Kaydet"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
