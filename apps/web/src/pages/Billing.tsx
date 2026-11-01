import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { PLANS } from "@fashionos/shared";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { fmtDate } from "../lib/utils";
import { PageHeader, useToast } from "../components/ui";

export default function Billing() {
  const { user, refresh } = useAuth();
  const [params] = useSearchParams();
  const toast = useToast();
  const status = useQuery({ queryKey: ["billing"], queryFn: () => api.get<{ available: boolean }>("/api/billing/plans") });
  useEffect(() => {
    if (params.get("status") === "success") { toast("Teşekkürler! Pro planın aktif ediliyor."); setTimeout(() => refresh(), 2500); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const go = async (path: string) => {
    try { window.location.href = (await api.post<{ url: string }>(path)).url; }
    catch (e) { toast((e as Error).message, "err"); }
  };
  const pro = user!.plan === "pro";

  return (
    <div className="pb-10">
      <PageHeader title="Abonelik" subtitle={pro && user!.planRenewsAt ? `Pro · ${fmtDate(user!.planRenewsAt, { day: "numeric", month: "long", year: "numeric" })} tarihinde yenilenir` : `${PLANS[user!.plan].label} plan`} />
      <div className="space-y-4 px-4">
        {(["free", "pro"] as const).map((k) => {
          const p = PLANS[k];
          const current = user!.plan === k;
          return (
            <div key={k} className={current ? "card p-5 ring-2 ring-ink" : "card p-5"}>
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xl">{p.label}</h2>
                <p className="text-xl font-semibold">₺{p.priceTry}<span className="text-sm font-normal text-stone-500">/ay</span></p>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                <li className="flex gap-2"><Check className="h-4 w-4 text-green-600" /> {p.maxItems.toLocaleString("tr-TR")} parça</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-green-600" /> Ayda {p.aiTagsPerMonth.toLocaleString("tr-TR")} otomatik etiketleme</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-green-600" /> Ayda {p.aiOutfitsPerMonth.toLocaleString("tr-TR")} stilist önerisi</li>
              </ul>
              {current ? (
                <p className="mt-4 text-sm font-medium">Mevcut planın</p>
              ) : k === "pro" ? (
                <button className="btn-primary mt-4 w-full" disabled={!status.data?.available} onClick={() => go("/api/billing/checkout")}>Pro'ya geç</button>
              ) : null}
            </div>
          );
        })}
        {pro && <button className="btn-secondary w-full" onClick={() => go("/api/billing/portal")}>Ödeme yöntemini / aboneliği yönet</button>}
        {!status.data?.available && <p className="text-center text-xs text-stone-500">Ödeme sistemi henüz etkin değil.</p>}
      </div>
    </div>
  );
}
