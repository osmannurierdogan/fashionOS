import { Link } from "react-router-dom";
import { Camera, CloudSun, Sparkles, Shirt, Luggage, BarChart3, Check } from "lucide-react";
import { PLANS } from "@fashionos/shared";

const features = [
  { icon: Camera, title: "Fotoğrafla, gerisi otomatik", text: "Arka plan silinir, renkler ve kategori yapay zekâ ile otomatik doldurulur." },
  { icon: CloudSun, title: "Havaya göre kombin", text: "Bulunduğun şehrin hava durumuna göre katman, mont ve ayakkabı seçilir." },
  { icon: Sparkles, title: "Kişisel stilist", text: "Etkinliğini yaz; renk uyumu ve resmiyeti dengeleyen kombinler gelsin." },
  { icon: Shirt, title: "Sadece senin gardırobun", text: "Öneriler yalnızca sahip olduğun parçalardan oluşur. Hiçbir şey satın aldırmaz." },
  { icon: Luggage, title: "Valiz listesi", text: "Seyahat günlerine göre en az parçayla en çok kombin." },
  { icon: BarChart3, title: "Gardırop analizi", text: "Hiç giymediklerin, giyim başı maliyet ve eksik temel parçalar." },
];

export function Landing() {
  return (
    <div className="mx-auto max-w-3xl px-5">
      <header className="flex items-center justify-between py-5">
        <span className="font-display text-2xl">fashionOS</span>
        <Link to="/login" className="btn-ghost">Giriş yap</Link>
      </header>
      <section className="py-12 text-center sm:py-20">
        <h1 className="font-display text-4xl leading-tight sm:text-5xl">
          Dolabın dolu,<br />ama giyecek bir şey yok mu?
        </h1>
        <p className="mx-auto mt-4 max-w-md text-stone-600">
          Gardırobunu fotoğrafla, fashionOS her sabah havaya ve gününe uygun kombini senin kıyafetlerinden hazırlasın.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/register" className="btn-primary px-6 py-3 text-base">Ücretsiz başla</Link>
          <Link to="/login" className="btn-secondary px-6 py-3 text-base">Giriş yap</Link>
        </div>
      </section>
      <section className="grid gap-4 pb-16 sm:grid-cols-2">
        {features.map((f) => (
          <div key={f.title} className="card p-5">
            <f.icon className="h-6 w-6 text-accent" />
            <h3 className="mt-3 font-medium">{f.title}</h3>
            <p className="mt-1 text-sm text-stone-600">{f.text}</p>
          </div>
        ))}
      </section>
      <section className="pb-20">
        <h2 className="text-center font-display text-3xl">Planlar</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {(Object.entries(PLANS) as [string, (typeof PLANS)[keyof typeof PLANS]][]).map(([k, p]) => (
            <div key={k} className={k === "pro" ? "card p-6 ring-2 ring-ink" : "card p-6"}>
              <h3 className="font-display text-xl">{p.label}</h3>
              <p className="mt-1 text-3xl font-semibold">{p.priceTry ? `₺${p.priceTry}` : "₺0"}<span className="text-sm font-normal text-stone-500">/ay</span></p>
              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex gap-2"><Check className="h-4 w-4 text-green-600" /> {p.maxItems.toLocaleString("tr-TR")} parçaya kadar</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-green-600" /> Ayda {p.aiTagsPerMonth.toLocaleString("tr-TR")} otomatik etiketleme</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-green-600" /> Ayda {p.aiOutfitsPerMonth.toLocaleString("tr-TR")} yapay zekâ stilist önerisi</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-green-600" /> Sınırsız kural tabanlı kombin</li>
              </ul>
            </div>
          ))}
        </div>
      </section>
      <footer className="border-t border-stone-200 py-6 text-center text-xs text-stone-500">
        © {new Date().getFullYear()} fashionOS · Verilerin sana aittir; dilediğin an indirip silebilirsin.
      </footer>
    </div>
  );
}
