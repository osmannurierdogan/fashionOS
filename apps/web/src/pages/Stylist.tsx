import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Sparkles, X } from "lucide-react";
import { OCCASIONS, type ItemDTO, type Occasion, type SuggestResponse } from "@fashionos/shared";
import { api } from "../lib/api";
import { cn, todayStr, fmtDate } from "../lib/utils";
import { Chips, Empty, Field, PageHeader, Spinner, useToast } from "../components/ui";
import { SuggestionCard } from "../components/SuggestionCard";
import { ItemPicker, useAllItems } from "../components/ItemPicker";
import { Collage } from "../components/Collage";
import { itemTitle } from "../components/ItemCard";

export default function Stylist() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  return (
    <div className="pb-8">
      <PageHeader title="Stilist" subtitle="Etkinliğini anlat, kombini birlikte bulalım" />
      <div className="mx-4 flex rounded-xl bg-stone-100 p-1 text-sm">
        <button onClick={() => setMode("ai")} className={cn("flex-1 rounded-lg py-2", mode === "ai" && "bg-white font-medium shadow-sm")}>Öneri al</button>
        <button onClick={() => setMode("manual")} className={cn("flex-1 rounded-lg py-2", mode === "manual" && "bg-white font-medium shadow-sm")}>Kendim oluşturayım</button>
      </div>
      <div className="px-4 pt-4">{mode === "ai" ? <AskStylist initialWith={params.get("with")} /> : <ManualBuilder />}</div>
    </div>
  );
}

function AskStylist({ initialWith }: { initialWith: string | null }) {
  const items = useAllItems();
  const [occasion, setOccasion] = useState<Occasion>("daily");
  const [note, setNote] = useState("");
  const [withId, setWithId] = useState<string | null>(initialWith);
  const [date, setDate] = useState(todayStr());
  const [picker, setPicker] = useState(false);
  const withItem = items.data?.find((i) => i.id === withId);
  const m = useMutation({
    mutationFn: () => api.post<SuggestResponse>("/api/outfits/suggest", { occasion, note, mustIncludeItemId: withId ?? undefined, date, count: 3 }),
  });

  return (
    <div>
      <div className="space-y-4">
        <div>
          <span className="label">Ne için?</span>
          <Chips options={OCCASIONS} value={occasion} onChange={setOccasion} />
        </div>
        <div>
          <span className="label">Ne zaman?</span>
          <Chips options={Array.from({ length: 7 }, (_, i) => [todayStr(i), i === 0 ? "Bugün" : i === 1 ? "Yarın" : fmtDate(todayStr(i), { weekday: "short", day: "numeric" })] as [string, string])} value={date} onChange={setDate} />
        </div>
        <Field label="Eklemek istediğin bir not var mı?">
          <textarea className="input min-h-20" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ör. Müşteri sunumu var, ciddi ama boğucu olmasın; akşam da yemeğe geçeceğim." maxLength={300} />
        </Field>
        <div>
          <span className="label">Mutlaka olsun (isteğe bağlı)</span>
          {withItem ? (
            <div className="chip pr-1.5">
              <img src={withItem.image.thumbUrl} alt="" className="h-6 w-6 object-contain" /> {itemTitle(withItem)}
              <button onClick={() => setWithId(null)} className="rounded-full p-0.5 hover:bg-stone-100" aria-label="Kaldır"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <button className="chip" onClick={() => setPicker(true)}><Plus className="h-4 w-4" /> Parça seç</button>
          )}
        </div>
        <button className="btn-primary w-full py-3" disabled={m.isPending} onClick={() => m.mutate()}>
          {m.isPending ? <><Spinner className="text-paper" /> Düşünüyorum…</> : <><Sparkles className="h-4 w-4" /> Kombin öner</>}
        </button>
      </div>

      {m.error && <p className="card mt-4 p-4 text-sm text-red-700">{(m.error as Error).message}</p>}
      {m.data && (
        <div className="mt-6 space-y-4">
          {m.data.suggestions.length ? (
            m.data.suggestions.map((s) => <SuggestionCard key={s.itemIds.join()} s={s} occasion={occasion} weather={m.data!.weather} date={date} />)
          ) : (
            <Empty title="Uygun kombin bulamadım" text={m.data.missing?.length ? "Gardırobunda bu koşullar için eksik parçalar var." : "Farklı bir etkinlik veya parça dene."} />
          )}
          {m.data.aiError && !m.data.aiUsed && <p className="text-xs text-stone-500">Not: Yapay zekâ stilist şu an yanıt veremedi, kural tabanlı öneriler gösteriliyor.</p>}
        </div>
      )}
      <ItemPicker open={picker} onClose={() => setPicker(false)} selected={withId ? [withId] : []} onToggle={(i) => { setWithId(i.id); setPicker(false); }} />
    </div>
  );
}

function ManualBuilder() {
  const qc = useQueryClient();
  const toast = useToast();
  const items = useAllItems();
  const [sel, setSel] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [picker, setPicker] = useState(false);
  const selected = sel.map((id) => items.data?.find((i) => i.id === id)).filter(Boolean) as ItemDTO[];
  const toggle = (i: ItemDTO) => setSel((s) => (s.includes(i.id) ? s.filter((x) => x !== i.id) : [...s, i.id].slice(0, 12)));

  const save = async (wear: boolean) => {
    try {
      const r = await api.post<{ outfit: { id: string } }>("/api/outfits", { itemIds: sel, name, source: "manual", saved: true });
      if (wear) await api.post("/api/wear", { itemIds: sel, outfitId: r.outfit.id });
      qc.invalidateQueries({ queryKey: ["outfits"] });
      qc.invalidateQueries({ queryKey: ["items"] });
      toast(wear ? "Kaydedildi ve bugün giyildi olarak işaretlendi" : "Kombin kaydedildi");
      setSel([]);
      setName("");
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  return (
    <div>
      {selected.length ? <Collage items={selected} /> : (
        <button onClick={() => setPicker(true)} className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 text-stone-500">
          <Plus className="h-8 w-8" /> Parça seçerek başla
        </button>
      )}
      {selected.length > 0 && (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {selected.map((i) => (
              <span key={i.id} className="chip pr-1.5">
                {itemTitle(i)}
                <button onClick={() => toggle(i)} className="rounded-full p-0.5 hover:bg-stone-100" aria-label="Çıkar"><X className="h-3.5 w-3.5" /></button>
              </span>
            ))}
            <button className="chip" onClick={() => setPicker(true)}><Plus className="h-4 w-4" /> Ekle</button>
          </div>
          <div className="mt-4">
            <Field label="Kombin adı"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ör. Cuma ofis" /></Field>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => save(false)}>Kaydet</button>
            <button className="btn-primary flex-1" onClick={() => save(true)}>Kaydet ve bugün giydim</button>
          </div>
        </>
      )}
      <ItemPicker open={picker} onClose={() => setPicker(false)} selected={sel} onToggle={toggle} title="Kombine parça ekle" />
    </div>
  );
}
