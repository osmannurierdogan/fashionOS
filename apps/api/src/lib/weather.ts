import type { WeatherDTO } from "@fashionos/shared";

// Open-Meteo: ücretsiz, anahtarsız. WMO hava kodları → Türkçe
const WMO: Record<number, string> = {
  0: "Açık", 1: "Çoğunlukla açık", 2: "Parçalı bulutlu", 3: "Kapalı",
  45: "Sisli", 48: "Kırağılı sis",
  51: "Hafif çisenti", 53: "Çisenti", 55: "Yoğun çisenti",
  56: "Donan çisenti", 57: "Donan çisenti",
  61: "Hafif yağmur", 63: "Yağmurlu", 65: "Şiddetli yağmur",
  66: "Donan yağmur", 67: "Donan yağmur",
  71: "Hafif kar", 73: "Karlı", 75: "Yoğun kar", 77: "Kar taneleri",
  80: "Sağanak", 81: "Sağanak", 82: "Şiddetli sağanak",
  85: "Kar sağanağı", 86: "Kar sağanağı",
  95: "Gök gürültülü fırtına", 96: "Dolu ve fırtına", 99: "Dolu ve fırtına",
};

const cache = new Map<string, { at: number; data: WeatherDTO[] }>();

/** 16 güne kadar günlük tahmin. Bugün için anlık sıcaklık da eklenir. */
export async function getForecast(lat: number, lon: number, days = 7): Promise<WeatherDTO[]> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)},${days}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 30 * 60_000) return hit.data;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max",
    timezone: "auto",
    forecast_days: String(Math.min(16, Math.max(1, days))),
  }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error("Hava durumu alınamadı");
  const j = (await res.json()) as any;
  const d = j.daily;
  const out: WeatherDTO[] = d.time.map((date: string, i: number) => {
    const code = d.weather_code[i] as number;
    const maxC = d.temperature_2m_max[i], minC = d.temperature_2m_min[i];
    // Gün içi "gündüz" sıcaklığı: max'a yakın ağırlıklı ortalama
    const day = 0.65 * maxC + 0.35 * minC;
    const feelDay = 0.65 * d.apparent_temperature_max[i] + 0.35 * d.apparent_temperature_min[i];
    return {
      date,
      tempC: Math.round(day),
      feelsC: Math.round(feelDay),
      minC: Math.round(minC),
      maxC: Math.round(maxC),
      precipitation: d.precipitation_sum[i] ?? 0,
      precipitationProbability: d.precipitation_probability_max?.[i] ?? 0,
      windKmh: Math.round(d.wind_speed_10m_max[i] ?? 0),
      condition: WMO[code] ?? "—",
      code,
      isRainy: [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code) || (d.precipitation_probability_max?.[i] ?? 0) >= 60,
      isSnowy: [71, 73, 75, 77, 85, 86].includes(code),
    };
  });
  if (out[0] && j.current) {
    out[0].tempC = Math.round(j.current.temperature_2m);
    out[0].feelsC = Math.round(j.current.apparent_temperature);
  }
  cache.set(key, { at: Date.now(), data: out });
  if (cache.size > 1000) cache.clear();
  return out;
}

export async function getWeatherFor(lat: number | null | undefined, lon: number | null | undefined, date?: string) {
  if (lat == null || lon == null) return null;
  try {
    const f = await getForecast(lat, lon, 16);
    if (!date) return f[0] ?? null;
    return f.find((w) => w.date === date) ?? null;
  } catch {
    return null;
  }
}

/** Şehir adından koordinat (Open-Meteo geocoding) */
export async function geocode(q: string) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({ name: q, count: "5", language: "tr", format: "json" }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const j = (await res.json()) as any;
  return ((j.results ?? []) as any[]).map((r) => ({
    name: r.name as string,
    admin: (r.admin1 ?? "") as string,
    country: (r.country ?? "") as string,
    lat: r.latitude as number,
    lon: r.longitude as number,
  }));
}
