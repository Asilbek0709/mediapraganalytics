/**
 * Veb-sahifani xavfsiz yuklab olish (ТЗ v2, 3.1).
 *
 *  - faqat http/https; ichki tarmoq manzillari (localhost, 10.x, 192.168.x, …) yopiq — server
 *    o‘z tarmog‘idagi xizmatlarga so‘rov yubora olmasin (SSRF);
 *  - har bir yo‘naltirish (redirect) qayta tekshiriladi, ko‘pi bilan 5 ta;
 *  - vaqt (20 s) va hajm (6 MB) chegarasi, kodlash (UTF-8, windows-1251 …) sarlavha/meta bo‘yicha.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { ApiError } from "./queries.ts";

const MAKS_HAJM = 6 * 1024 * 1024;
const VAQT = 20_000;
const MAKS_YONALISH = 5;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 MediaPrag-Analytics";

/** Ichki (yopiq) manzilmi — IPv4 va IPv6 */
export function ichkiManzilmi(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  const s = ip.toLowerCase();
  if (s === "::1" || s === "::") return true;
  if (s.startsWith("fc") || s.startsWith("fd") || s.startsWith("fe80")) return true;
  const m = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return m ? ichkiManzilmi(m[1]) : false;
}

async function manzilniTekshir(u: URL): Promise<void> {
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new ApiError(400, "x.havolaNotogri");
  if (u.username || u.password) throw new ApiError(400, "x.havolaNotogri");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new ApiError(400, "x.havolaIchki");
  const ipLar = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((x) => x.address);
  if (!ipLar.length) throw new ApiError(400, "x.havolaTopilmadi");
  if (ipLar.some(ichkiManzilmi)) throw new ApiError(400, "x.havolaIchki");
}

function kodlash(contentType: string | null, bosh: Uint8Array): string {
  const sarlavhadan = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];
  if (sarlavhadan) return sarlavhadan;
  const ascii = new TextDecoder("latin1").decode(bosh.subarray(0, 4096));
  return ascii.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ?? "utf-8";
}

export interface YuklanganSahifa {
  html: string;
  /** yo‘naltirishlardan keyingi yakuniy manzil */
  url: string;
}

export async function sahifaniYuklash(havola: string): Promise<YuklanganSahifa> {
  let u: URL;
  try {
    u = new URL(havola.trim());
  } catch {
    throw new ApiError(400, "x.havolaNotogri");
  }
  const signal = AbortSignal.timeout(VAQT);
  for (let i = 0; i <= MAKS_YONALISH; i++) {
    await manzilniTekshir(u);
    let javob: Response;
    try {
      javob = await fetch(u, {
        redirect: "manual",
        signal,
        headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5", "Accept-Language": "uz,ru;q=0.8,en;q=0.5" },
      });
    } catch (e) {
      throw new ApiError(502, (e as Error)?.name === "TimeoutError" ? "x.havolaVaqt" : "x.havolaYuklanmadi");
    }
    if (javob.status >= 300 && javob.status < 400 && javob.headers.get("location")) {
      u = new URL(javob.headers.get("location")!, u);
      continue;
    }
    if (!javob.ok) throw new ApiError(502, "x.havolaHolat", { s: javob.status });
    const tur = javob.headers.get("content-type") ?? "";
    if (tur && !/html|xml/i.test(tur)) throw new ApiError(415, "x.havolaHtmlEmas");

    // hajm chegarasi bilan o‘qish
    const reader = javob.body?.getReader();
    const bolaklar: Uint8Array[] = [];
    let jami = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        jami += value.byteLength;
        if (jami > MAKS_HAJM) {
          await reader.cancel();
          throw new ApiError(413, "x.havolaKatta");
        }
        bolaklar.push(value);
      }
    }
    const bayt = new Uint8Array(jami);
    let o = 0;
    for (const b of bolaklar) {
      bayt.set(b, o);
      o += b.byteLength;
    }
    let html: string;
    try {
      html = new TextDecoder(kodlash(tur, bayt)).decode(bayt);
    } catch {
      html = new TextDecoder("utf-8").decode(bayt);
    }
    return { html, url: u.toString() };
  }
  throw new ApiError(502, "x.havolaYonalish");
}
