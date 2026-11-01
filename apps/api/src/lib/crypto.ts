import { createHash, createHmac, randomBytes } from "node:crypto";
import { config } from "../config.js";

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const hashToken = (token: string) => createHmac("sha256", config.sessionSecret).update(token).digest("hex");
export const sha1 = (s: string) => createHash("sha1").update(s).digest("hex");
