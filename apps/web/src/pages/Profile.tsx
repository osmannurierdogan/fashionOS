import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Download, LogOut, MapPin, Search } from "lucide-react";
import { PALETTE, STYLES, PLANS, type Profile as ProfileT, type UserDTO } from "@fashionos/shared";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { cn } from "../lib/utils";
import { Chips, Field, PageHeader, Sheet, Spinner, useToast } from "../components/ui";

function ColorPick({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PALETTE.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onChange(value.includes(p.key) ? value.filter((x) => x !== p.key) : [...value, p.key])}
          className={cn("h-8 w-8 rounded-full ring-1 ring-black/10", value.includes(p.key) && "ring-2 ring-ink ring-offset-2")}
          style={{ background: p.hex }}
          title={p.name}
          aria-label={p.name}
          aria-pressed={value.includes(p.key)}
        />
      ))}
    </div>
  );
}

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(user!.name);
  const [p, setP] = useState<ProfileT>(user!.profile);
  const [saving, setSaving] = useState(false);
  const [cityQ, setCityQ] = useState("");
  const [cities, setCities] = useState<{ name: string; admin: string; country: string; lat: number; lon: number }[]>([]);
  const [pw, setPw] = useState({ open: false, currentPassword: "", newPassword: "" });
  const [del, setDel] = useState({ open: false, password: "" });
  useEffect(() => { setP(user!.profile); setName(user!.name); }, [user]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.patch<{ user: UserDTO }>("/api/profile", { name, ...p });
      setUser(r.user);
      qc.removeQueries({ queryKey: ["suggest"] });
      qc.invalidateQueries({ queryKey: ["weather"] });
      toast("Profil kaydedildi");
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setSaving(false);
    }
  };

  const findCity = async () => {
    if (cityQ.trim().length < 2) return;
    try {
      setCities((await api.get<{ results: typeof cities }>(`/api/geocode?q=${encodeURIComponent(cityQ.trim())}`)).results);
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  const useLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setP({ ...p, lat: +pos.coords.latitude.toFixed(4), lon: +pos.coords.longitude.toFixed(4), city: "Konumum" });
        toast("Konum alındı, kaydetmeyi unutma");
      },
      () => toast("Konum izni verilmedi", "err"),
    );
  };

  const limits = user!.limits;
  const usage = user!.usage;

  return (
    <div className="pb-10">
      <PageHeader title="Profil" subtitle={user!.email} />
      <div className="space-y-6 px-4">
        {!user!.emailVerified && (
          <div className="card flex items-center justify-between gap-3 p-4 text-sm">
            <span>E-posta adresin henüz doğrulanmadı.</span>
            <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => api.post("/api/auth/verify-email/send").then(() => toast("Doğrulama e-postası gönderildi"))}>Tekrar gönder</button>
          </div>
        )}

        <Link to="/settings/billing" className="card flex items-center justify-between p-4">
          <div>
            <p className="font-medium">{PLANS[user!.plan].label} plan</p>
            <p className="text-xs text-stone-500">
              {user!.itemCount}/{limits.maxItems} parça · Bu ay {usage.aiTags}/{limits.aiTagsPerMonth} etiketleme, {usage.aiOutfits}/{limits.aiOutfitsPerMonth} stilist önerisi
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-stone-400" />
        </Link>

        <section className="card space-y-5 p-4">
          <h2 className="font-display text-xl">Stil profilim</h2>
          <p className="-mt-3 text-xs text-stone-500">Öneriler bu tercihlere göre kişiselleşir.</p>
          <Field label="Adın"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <div>
            <span className="label">Kesim tercihi</span>
            <Chips options={{ unspecified: "Belirtmek istemiyorum", female: "Kadın", male: "Erkek", unisex: "Unisex" }} value={p.gender} onChange={(v: ProfileT["gender"]) => setP({ ...p, gender: v })} />
          </div>
          <div>
            <span className="label">Tarzım</span>
            <Chips multi options={STYLES} value={p.styles} onChange={(v: ProfileT["styles"]) => setP({ ...p, styles: v })} />
          </div>
          <div>
            <span className="label">Sevdiğim renkler</span>
            <ColorPick value={p.favoriteColors} onChange={(v) => setP({ ...p, favoriteColors: v, avoidColors: p.avoidColors.filter((x) => !v.includes(x)) })} />
          </div>
          <div>
            <span className="label">Kaçındığım renkler</span>
            <ColorPick value={p.avoidColors} onChange={(v) => setP({ ...p, avoidColors: v, favoriteColors: p.favoriteColors.filter((x) => !v.includes(x)) })} />
          </div>
          <Field label="Stilistin bilmesi gerekenler" hint="ör. Dar paça sevmem, toplantılarda kravat takmam, rahat ayakkabı tercih ederim.">
            <textarea className="input min-h-20" maxLength={500} value={p.fitNotes} onChange={(e) => setP({ ...p, fitNotes: e.target.value })} />
          </Field>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-ink" checked={p.runsCold} onChange={(e) => setP({ ...p, runsCold: e.target.checked })} />
            Çabuk üşüyen biriyim (daha kalın öner)
          </label>
          <div>
            <span className="label">Şehir (hava durumu için)</span>
            <p className="mb-2 flex items-center gap-1.5 text-sm"><MapPin className="h-4 w-4 text-stone-400" /> {p.city || "Seçilmedi"}</p>
            <div className="flex gap-2">
              <input className="input" placeholder="Şehir ara" value={cityQ} onChange={(e) => setCityQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && findCity()} />
              <button className="btn-secondary px-3" onClick={findCity} aria-label="Ara"><Search className="h-4 w-4" /></button>
            </div>
            {cities.length > 0 && (
              <div className="mt-2 divide-y divide-stone-100 rounded-xl ring-1 ring-stone-200">
                {cities.map((c) => (
                  <button key={`${c.lat},${c.lon}`} className="block w-full px-3 py-2 text-left text-sm" onClick={() => { setP({ ...p, city: c.name, lat: c.lat, lon: c.lon }); setCities([]); setCityQ(""); }}>
                    {c.name} <span className="text-stone-500">{[c.admin, c.country].filter(Boolean).join(", ")}</span>
                  </button>
                ))}
              </div>
            )}
            <button className="mt-2 text-sm text-stone-600 underline" onClick={useLocation}>Konumumu kullan</button>
          </div>
          <button className="btn-primary w-full" onClick={save} disabled={saving}>{saving ? <Spinner className="text-paper" /> : "Kaydet"}</button>
        </section>

        <section className="card divide-y divide-stone-100">
          <Link to="/stats" className="flex items-center justify-between p-4 text-sm">Gardırop analizi <ChevronRight className="h-4 w-4 text-stone-400" /></Link>
          <button className="flex w-full items-center justify-between p-4 text-left text-sm" onClick={() => setPw({ ...pw, open: true })}>Şifre değiştir <ChevronRight className="h-4 w-4 text-stone-400" /></button>
          <a href="/api/account/export" className="flex items-center justify-between p-4 text-sm">Verilerimi indir (KVKK) <Download className="h-4 w-4 text-stone-400" /></a>
          <button className="flex w-full items-center justify-between p-4 text-left text-sm" onClick={async () => { await api.post("/api/auth/logout-all"); await logout(); nav("/welcome"); }}>Tüm cihazlardan çıkış yap <LogOut className="h-4 w-4 text-stone-400" /></button>
          <button className="flex w-full items-center justify-between p-4 text-left text-sm text-red-600" onClick={() => setDel({ ...del, open: true })}>Hesabımı ve tüm verilerimi sil</button>
        </section>

        <button className="btn-secondary w-full" onClick={async () => { await logout(); nav("/welcome"); }}><LogOut className="h-4 w-4" /> Çıkış yap</button>
      </div>

      <Sheet open={pw.open} onClose={() => setPw({ open: false, currentPassword: "", newPassword: "" })} title="Şifre değiştir">
        <div className="space-y-3">
          <Field label="Mevcut şifre"><input type="password" className="input" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
          <Field label="Yeni şifre" hint="En az 8 karakter"><input type="password" className="input" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
          <button className="btn-primary w-full" onClick={async () => {
            try { await api.post("/api/auth/change-password", { currentPassword: pw.currentPassword, newPassword: pw.newPassword }); toast("Şifre değiştirildi"); setPw({ open: false, currentPassword: "", newPassword: "" }); }
            catch (e) { toast((e as Error).message, "err"); }
          }}>Kaydet</button>
        </div>
      </Sheet>

      <Sheet open={del.open} onClose={() => setDel({ open: false, password: "" })} title="Hesabı sil">
        <p className="text-sm text-stone-600">Tüm parçaların, fotoğrafların, kombinlerin ve giyim geçmişin kalıcı olarak silinecek. Varsa aboneliğin iptal edilir. Bu işlem geri alınamaz.</p>
        <div className="mt-4 space-y-3">
          <Field label="Onaylamak için şifreni gir"><input type="password" className="input" value={del.password} onChange={(e) => setDel({ ...del, password: e.target.value })} /></Field>
          <button className="btn-danger w-full" onClick={async () => {
            try { await api.del("/api/account", { password: del.password }); qc.clear(); setUser(null); nav("/welcome"); }
            catch (e) { toast((e as Error).message, "err"); }
          }}>Her şeyi kalıcı olarak sil</button>
        </div>
      </Sheet>
    </div>
  );
}
