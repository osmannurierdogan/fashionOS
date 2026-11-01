import type { FastifyInstance } from "fastify";
import { currentUser, requireAuth } from "../lib/auth.js";
import { badRequest } from "../lib/errors.js";
import { geocode, getForecast } from "../lib/weather.js";

export async function weatherRoutes(app: FastifyInstance) {
  app.get("/weather", { preHandler: requireAuth }, async (req) => {
    const user = currentUser(req);
    const q = req.query as Record<string, string | undefined>;
    const lat = q.lat ? Number(q.lat) : user.profile?.lat;
    const lon = q.lon ? Number(q.lon) : user.profile?.lon;
    if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) return { forecast: [], city: null };
    try {
      const forecast = await getForecast(lat, lon, Number(q.days ?? 7));
      return { forecast, city: q.lat ? null : user.profile?.city ?? null };
    } catch {
      return { forecast: [], city: null, error: "Hava durumu alınamadı" };
    }
  });

  app.get("/geocode", { preHandler: requireAuth }, async (req) => {
    const q = (req.query as { q?: string }).q?.trim();
    if (!q || q.length < 2) throw badRequest("Şehir adı girin");
    return { results: await geocode(q) };
  });
}
