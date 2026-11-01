export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = "error",
    public details?: unknown,
  ) {
    super(message);
  }
}
export const badRequest = (m: string, details?: unknown) => new HttpError(400, m, "bad_request", details);
export const unauthorized = (m = "Giriş yapmanız gerekiyor") => new HttpError(401, m, "unauthorized");
export const forbidden = (m = "Bu işlem için yetkiniz yok") => new HttpError(403, m, "forbidden");
export const notFound = (m = "Bulunamadı") => new HttpError(404, m, "not_found");
export const paymentRequired = (m: string) => new HttpError(402, m, "quota_exceeded");
export const unavailable = (m: string) => new HttpError(503, m, "unavailable");
