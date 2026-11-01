import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun } from "lucide-react";
import type { WeatherDTO } from "@fashionos/shared";

export function WeatherIcon({ code, className }: { code: number; className?: string }) {
  const C =
    code === 0 ? Sun
    : code <= 2 ? CloudSun
    : code === 3 ? Cloud
    : code <= 48 ? CloudFog
    : code <= 57 ? CloudDrizzle
    : code <= 67 || (code >= 80 && code <= 82) ? CloudRain
    : code <= 77 || code === 85 || code === 86 ? CloudSnow
    : CloudLightning;
  return <C className={className} />;
}

export function WeatherCard({ w, city }: { w: WeatherDTO; city?: string | null }) {
  return (
    <div className="card flex items-center gap-4 p-4">
      <WeatherIcon code={w.code} className="h-10 w-10 text-accent" />
      <div className="flex-1">
        <p className="text-2xl font-semibold">
          {w.tempC}°<span className="ml-2 text-sm font-normal text-stone-500">hissedilen {w.feelsC}°</span>
        </p>
        <p className="text-sm text-stone-600">
          {w.condition}
          {city ? ` · ${city}` : ""} · {w.minC}° / {w.maxC}°
          {w.precipitationProbability >= 30 ? ` · %${w.precipitationProbability} yağış` : ""}
        </p>
      </div>
    </div>
  );
}
