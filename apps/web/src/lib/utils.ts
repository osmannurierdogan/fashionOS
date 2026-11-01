export { clsx as cn } from "clsx";

export const fmtDate = (d: string | Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }) =>
  new Date(d).toLocaleDateString("tr-TR", opts);

export const fmtMoney = (n: number) => n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });

export const todayStr = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const relDays = (iso: string | null) => {
  if (!iso) return "Hiç giyilmedi";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  if (days <= 0) return "Bugün giyildi";
  if (days === 1) return "Dün giyildi";
  if (days < 30) return `${days} gün önce giyildi`;
  if (days < 365) return `${Math.floor(days / 30)} ay önce giyildi`;
  return "1 yıldan uzun süre önce";
};
