/**
 * AI-taklif (ТЗ v2, 3-bosqich): Claude materialni o‘qib, III bob mezonlari bo‘yicha belgilarni faqat TAKLIF qiladi.
 *
 *  - hech narsa avtomatik saqlanmaydi: tahlilga va LPSI ga faqat tadqiqotchi tasdiqlagan yoki o‘zgartirgan
 *    belgilar tushadi (tahlilSaqlash orqali);
 *  - har bir taklif (qiymat, asos, ishonch, model, prompt versiyasi) va tadqiqotchining yakuniy qarori
 *    alohida saqlanadi — AI–tadqiqotchi mosligi (foiz, Cohen κ) shundan hisoblanadi;
 *  - API kaliti faqat serverda (ANTHROPIC_API_KEY); kunlik so‘rovlar chegarasi bor;
 *  - AI matn yaratmaydi: taklif qilingan fragment materialda so‘zma-so‘z topilmasa — tashlanadi.
 */
import { createHash } from "node:crypto";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";

import { all, hozir, one, run, transaction } from "../db.ts";
import { ApiError, tahlilSaqlash, type TahlilSaqlash } from "../queries.ts";
import { cohenKappa, kappaTalqini, type KappaNatija, type KappaTalqini } from "../statistika.ts";
import type { Belgi, Material, Qism } from "../types.ts";
import { promptYasash, materialXabari, STANDART_TARIFLAR, type AiMetodika } from "./yoriqnoma.ts";

// ------------------------------------------------------------------ sozlamalar

export const AI_MODEL = process.env.MEDIAPRAG_AI_MODEL?.trim() || "claude-opus-5-5";
const AI_EFFORT = (process.env.MEDIAPRAG_AI_EFFORT?.trim() || "high") as "low" | "medium" | "high" | "xhigh" | "max";
const STANDART_KUNLIK = 100;
const QISMLAR: Qism[] = ["sarlavha", "lid", "matn"];
export const MAYDON_BLOKLARI = ["sarlavha_turlari", "sar_lid", "lid_matn", "sar_matn", "kompozitsiya"] as const;
export type MaydonBloki = (typeof MAYDON_BLOKLARI)[number];
export type Ishonch = "past" | "orta" | "yuqori";
export type Qaror = "tasdiqlangan" | "ozgartirilgan" | "rad";

export interface AiHolati {
  /** ANTHROPIC_API_KEY o‘rnatilganmi (qiymati hech qachon ko‘rsatilmaydi) */
  kalitBor: boolean;
  yoqilgan: boolean;
  model: string;
  kunlikChegara: number;
  bugun: number;
  tariflar: string;
  standartTariflar: boolean;
}

async function sozlama(kalit: string): Promise<string | null> {
  return (await one<{ qiymat: string }>("SELECT qiymat FROM sozlamalar WHERE kalit = ?", [kalit]))?.qiymat ?? null;
}
async function sozlamaYoz(kalit: string, qiymat: string) {
  await run("INSERT INTO sozlamalar (kalit, qiymat) VALUES (?, ?) ON CONFLICT (kalit) DO UPDATE SET qiymat = excluded.qiymat", [kalit, qiymat]);
}

const bugunBoshi = () => hozir().slice(0, 10);

export async function aiHolati(): Promise<AiHolati> {
  const tariflar = (await sozlama("ai_tariflar")) ?? STANDART_TARIFLAR;
  return {
    kalitBor: !!process.env.ANTHROPIC_API_KEY?.trim(),
    yoqilgan: (await sozlama("ai_yoqilgan")) !== "0",
    model: AI_MODEL,
    kunlikChegara: Number(await sozlama("ai_kunlik")) || STANDART_KUNLIK,
    bugun: (await one<{ n: number }>("SELECT COUNT(*) AS n FROM ai_sorovlar WHERE vaqt >= ?", [bugunBoshi()]))?.n ?? 0,
    tariflar,
    standartTariflar: tariflar === STANDART_TARIFLAR,
  };
}

/** Administrator: AI ni yoqish/o‘chirish, kunlik chegara, ta’riflar matni */
export async function aiSozlash(data: unknown): Promise<AiHolati> {
  const d = (data ?? {}) as Record<string, unknown>;
  if (typeof d.yoqilgan === "boolean") await sozlamaYoz("ai_yoqilgan", d.yoqilgan ? "1" : "0");
  if (d.kunlikChegara != null) {
    const n = Number(d.kunlikChegara);
    if (!Number.isInteger(n) || n < 1 || n > 10000) throw new ApiError(422, "x.aiChegaraNotogri");
    await sozlamaYoz("ai_kunlik", String(n));
  }
  if (typeof d.tariflar === "string") {
    const t = d.tariflar.trim();
    if (t.length > 30000) throw new ApiError(422, "x.aiTariflarUzun");
    await sozlamaYoz("ai_tariflar", t || STANDART_TARIFLAR);
  }
  return aiHolati();
}

// ------------------------------------------------------------------ javob sxemasi

async function aiMetodika(): Promise<AiMetodika> {
  const lugat = await all<{ turkum: string; kod: string; nomi: string }>(
    "SELECT turkum, kod, nomi FROM lugat WHERE turkum IN ('sarlavha_turi', 'muvofiqlik', 'kompozitsiya') ORDER BY turkum, tartib",
  );
  const v = (turkum: string) => lugat.filter((l) => l.turkum === turkum).map(({ kod, nomi }) => ({ kod, nomi }));
  return {
    sarlavhaTurlari: v("sarlavha_turi"),
    muvofiqlik: v("muvofiqlik"),
    kompozitsiya: v("kompozitsiya"),
    kategoriyalar: await all<{ kod: string; nomi: string; guruh: "muammo" | "vosita" }>(
      "SELECT kod, nomi, guruh FROM kategoriyalar ORDER BY tartib",
    ),
  };
}

const enumi = (v: { kod: string }[]) => z.enum(v.map((x) => x.kod) as [string, ...string[]]);

export function javobSxemasi(m: AiMetodika) {
  const ishonch = z.enum(["past", "orta", "yuqori"]);
  const muv = enumi(m.muvofiqlik);
  const maydon = <T extends z.ZodType>(qiymat: T) => z.object({ qiymat, asos: z.string(), ishonch });
  return z.object({
    sarlavha_turlari: maydon(z.array(enumi(m.sarlavhaTurlari))),
    sar_lid: maydon(muv.nullable()),
    lid_matn: maydon(muv.nullable()),
    sar_matn: maydon(muv.nullable()),
    kompozitsiya: maydon(enumi(m.kompozitsiya).nullable()),
    belgilar: z.array(
      z.object({
        kategoriya: enumi(m.kategoriyalar),
        qism: z.enum(["sarlavha", "lid", "matn"]),
        fragment: z.string(),
        asos: z.string(),
        ishonch,
      }),
    ),
  });
}
export type AiJavob = z.infer<ReturnType<typeof javobSxemasi>>;

// ------------------------------------------------------------------ Claude chaqiruvi

export interface ChaqiruvNatijasi {
  javob: AiJavob | null;
  /** javob bergan model (zaxira modelga o‘tgan bo‘lishi mumkin) */
  model: string;
  toxtash: string | null;
  kirishToken: number;
  chiqishToken: number;
}
export type AiChaqiruv = (p: { tizim: string; xabar: string; sxema: ReturnType<typeof javobSxemasi> }) => Promise<ChaqiruvNatijasi>;

/** Haqiqiy chaqiruv: Claude API, tuzilmali javob (zod sxemasi), rad etilsa — server tomonidagi zaxira model */
export const claudeChaqiruvi: AiChaqiruv = async ({ tizim, xabar, sxema }) => {
  const mijoz = new Anthropic(); // ANTHROPIC_API_KEY — muhit o‘zgaruvchisidan
  const j = await mijoz.beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: AI_EFFORT, format: betaZodOutputFormat(sxema) },
    // yo‘riqnoma o‘zgarmaguncha keshlanadi — keyingi materiallar arzonroq
    system: [{ type: "text", text: tizim, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: xabar }],
  });
  return {
    javob: j.stop_reason === "refusal" ? null : (j.parsed_output as AiJavob | null),
    model: j.model,
    toxtash: j.stop_reason,
    kirishToken: (j.usage.input_tokens ?? 0) + (j.usage.cache_read_input_tokens ?? 0) + (j.usage.cache_creation_input_tokens ?? 0),
    chiqishToken: j.usage.output_tokens ?? 0,
  };
};

function chaqiruvXatosi(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return new ApiError(502, "x.aiKalitNotogri");
  if (e instanceof Anthropic.RateLimitError) return new ApiError(429, "x.aiBand");
  if (e instanceof Anthropic.APIConnectionError) return new ApiError(502, "x.aiUlanish");
  if (e instanceof Anthropic.APIError) return new ApiError(502, "x.aiXato", { s: e.status ?? 0 });
  return new ApiError(502, "x.aiXato", { s: 0 });
}

// ------------------------------------------------------------------ fragmentni tekshirish

const norm = (s: string) =>
  s
    .normalize("NFC")
    .replace(/[‘’ʻʼ`´']/g, "'")
    .replace(/[«»“”„"]/g, '"')
    .replace(/\s+/g, " ")
    .trim();

/**
 * Fragment materialning ko‘rsatilgan (yoki boshqa) qismida so‘zma-so‘z bormi. Topilsa — materialdagi asl
 * yozilishi va qismi qaytadi; topilmasa — null (AI matn o‘ylab topmasligi uchun bunday taklif tashlanadi).
 */
export function fragmentniTop(m: Pick<Material, "sarlavha" | "lid" | "matn">, qism: Qism, fragment: string): { qism: Qism; fragment: string } | null {
  const f = norm(fragment);
  if (f.length < 2) return null;
  for (const q of [qism, ...QISMLAR.filter((x) => x !== qism)]) {
    const asl = q === "sarlavha" ? m.sarlavha : q === "lid" ? m.lid : m.matn;
    if (!asl) continue;
    const n = norm(asl);
    let i = n.indexOf(f);
    if (i < 0) i = n.toLocaleLowerCase().indexOf(f.toLocaleLowerCase());
    if (i >= 0) return { qism: q, fragment: n.slice(i, i + f.length) };
  }
  return null;
}

// ------------------------------------------------------------------ taklif olish

export interface AiTaklif {
  id: number;
  blok: MaydonBloki | "belgi";
  /** maydon uchun — kod (sarlavha turlari — kodlar ro‘yxati); belgi uchun — {kategoriya, qism, fragment} */
  qiymat: unknown;
  asos: string;
  ishonch: Ishonch;
}

export interface AiNatija {
  sorov_id: number;
  model: string;
  prompt_versiya: string;
  takliflar: AiTaklif[];
  /** materialda topilmagani uchun tashlangan belgilar soni */
  tashlandi: number;
}

export async function aiTaklifOlish(
  materialId: number,
  foydalanuvchi: string | null,
  material: Material,
  chaqiruv: AiChaqiruv = claudeChaqiruvi,
): Promise<AiNatija> {
  const h = await aiHolati();
  if (!h.kalitBor && chaqiruv === claudeChaqiruvi) throw new ApiError(503, "x.aiKalitYoq");
  if (!h.yoqilgan) throw new ApiError(403, "x.aiOchirilgan");
  if (h.bugun >= h.kunlikChegara) throw new ApiError(429, "x.aiChegara", { n: h.kunlikChegara });
  if (material.manba_turi === "suniy") throw new ApiError(409, "x.aiSuniy");
  if (material.tekshirilgan === false) throw new ApiError(409, "x.tekshirilmagan");

  const met = await aiMetodika();
  const tizim = promptYasash(met, h.tariflar);
  const versiya = `v1-${createHash("sha256").update(tizim).digest("hex").slice(0, 10)}`;
  await run("INSERT INTO ai_promptlar (versiya, matn, yaratilgan) VALUES (?, ?, ?) ON CONFLICT (versiya) DO NOTHING", [versiya, tizim, hozir()]);

  let n: ChaqiruvNatijasi;
  try {
    n = await chaqiruv({ tizim, xabar: materialXabari({ ...material, lid: material.lid, matn: material.matn }), sxema: javobSxemasi(met) });
  } catch (e) {
    const x = chaqiruvXatosi(e);
    await run(
      "INSERT INTO ai_sorovlar (material_id, foydalanuvchi, model, prompt_versiya, vaqt, holat, xato) VALUES (?, ?, ?, ?, ?, 'xato', ?)",
      [materialId, foydalanuvchi, AI_MODEL, versiya, hozir(), x.xabarlar[0].k],
    );
    throw x;
  }
  const holat = n.javob ? "ok" : n.toxtash === "refusal" ? "rad" : "bosh";
  const sorov = await one<{ id: number }>(
    `INSERT INTO ai_sorovlar (material_id, foydalanuvchi, model, prompt_versiya, vaqt, kirish_token, chiqish_token, holat)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [materialId, foydalanuvchi, n.model, versiya, hozir(), n.kirishToken, n.chiqishToken, holat],
  );
  if (!n.javob) throw new ApiError(502, n.toxtash === "refusal" ? "x.aiRad" : n.toxtash === "max_tokens" ? "x.aiUzun" : "x.aiBosh");

  const j = n.javob;
  const vaqt = hozir();
  const takliflar: AiTaklif[] = [];
  const yoz = async (blok: AiTaklif["blok"], qiymat: unknown, asos: string, ishonch: Ishonch) => {
    const r = await one<{ id: number }>(
      `INSERT INTO ai_takliflar (sorov_id, material_id, blok, taklif_qiymati, asos, ishonch, model, prompt_versiya, yaratilgan_sana)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [sorov!.id, materialId, blok, JSON.stringify(qiymat), asos, ishonch, n.model, versiya, vaqt],
    );
    takliflar.push({ id: r!.id, blok, qiymat, asos, ishonch });
  };

  const lidYoq = !material.lid?.trim();
  for (const blok of MAYDON_BLOKLARI) {
    const t = j[blok];
    const qiymat = lidYoq && (blok === "sar_lid" || blok === "lid_matn") ? null : t.qiymat;
    if (qiymat == null || (Array.isArray(qiymat) && !qiymat.length && blok !== "sarlavha_turlari")) continue;
    await yoz(blok, blok === "sarlavha_turlari" ? [...new Set(qiymat as string[])] : qiymat, t.asos, t.ishonch);
  }
  let tashlandi = 0;
  const korilgan = new Set<string>();
  for (const b of j.belgilar) {
    const topildi = fragmentniTop(material, b.qism, b.fragment);
    const kalit = topildi && `${b.kategoriya}|${topildi.qism}|${topildi.fragment}`;
    if (!topildi || korilgan.has(kalit!)) {
      tashlandi++;
      continue;
    }
    korilgan.add(kalit!);
    await yoz("belgi", { kategoriya: b.kategoriya, qism: topildi.qism, fragment: topildi.fragment }, b.asos, b.ishonch);
  }
  return { sorov_id: sorov!.id, model: n.model, prompt_versiya: versiya, takliflar, tashlandi };
}

/** Materialning hali qaror qabul qilinmagan oxirgi takliflari (sahifa qayta ochilganda) */
export async function kutilayotganTakliflar(materialId: number): Promise<AiNatija | null> {
  const s = await one<{ id: number; model: string; prompt_versiya: string }>(
    `SELECT s.id, s.model, s.prompt_versiya FROM ai_sorovlar s
     WHERE s.material_id = ? AND s.holat = 'ok' AND EXISTS (SELECT 1 FROM ai_takliflar t WHERE t.sorov_id = s.id AND t.yakuniy_qaror IS NULL)
     ORDER BY s.id DESC LIMIT 1`,
    [materialId],
  );
  if (!s) return null;
  const rows = await all<{ id: number; blok: AiTaklif["blok"]; taklif_qiymati: string; asos: string; ishonch: Ishonch }>(
    "SELECT id, blok, taklif_qiymati, asos, ishonch FROM ai_takliflar WHERE sorov_id = ? AND yakuniy_qaror IS NULL ORDER BY id",
    [s.id],
  );
  return {
    sorov_id: s.id,
    model: s.model,
    prompt_versiya: s.prompt_versiya,
    takliflar: rows.map((r) => ({ id: r.id, blok: r.blok, qiymat: JSON.parse(r.taklif_qiymati), asos: r.asos, ishonch: r.ishonch })),
    tashlandi: 0,
  };
}

// ------------------------------------------------------------------ tadqiqotchi qarori

export interface AiQarorKirish {
  id: number;
  qaror: Qaror;
}

const tengmi = (a: unknown, b: unknown) =>
  Array.isArray(a) && Array.isArray(b) ? [...a].sort().join("|") === [...b].sort().join("|") : (a ?? null) === (b ?? null);

/**
 * Tahlil saqlanganda chaqiriladi (o‘sha tranzaksiyada): har bir ko‘rib chiqilgan taklifning yakuniy qarori.
 * Maydonlarda yakuniy qiymat — saqlangan tahlildagi qiymat (teng — tasdiqlangan, boshqa — o‘zgartirilgan);
 * belgilarda — taklifga bog‘langan saqlangan belgi (bo‘lmasa — rad).
 */
export async function aiQarorlariniYozish(
  materialId: number,
  qarorlar: AiQarorKirish[],
  tahlil: Record<MaydonBloki, unknown>,
  bogBelgilar: Map<number, Belgi>,
  foydalanuvchi: string | null,
): Promise<void> {
  if (!qarorlar.length) return;
  const vaqt = hozir();
  for (const q of qarorlar) {
    const t = await one<{ id: number; blok: AiTaklif["blok"]; taklif_qiymati: string }>(
      "SELECT id, blok, taklif_qiymati FROM ai_takliflar WHERE id = ? AND material_id = ?",
      [q.id, materialId],
    );
    if (!t) continue;
    const ai = JSON.parse(t.taklif_qiymati) as unknown;
    let qaror: Qaror;
    let yakuniy: unknown = null;
    if (t.blok === "belgi") {
      const b = bogBelgilar.get(t.id);
      if (!b || q.qaror === "rad") qaror = "rad";
      else {
        const a = ai as { kategoriya: string; qism: string; fragment: string };
        yakuniy = { kategoriya: b.kategoriya, qism: b.qism, fragment: b.fragment };
        qaror = a.kategoriya === b.kategoriya && a.qism === b.qism && norm(a.fragment) === norm(b.fragment ?? "") ? "tasdiqlangan" : "ozgartirilgan";
      }
    } else {
      yakuniy = tahlil[t.blok] ?? null;
      qaror = q.qaror === "rad" ? "rad" : tengmi(ai, yakuniy) ? "tasdiqlangan" : "ozgartirilgan";
    }
    await run(
      "UPDATE ai_takliflar SET yakuniy_qaror = ?, yakuniy_qiymat = ?, qaror_beruvchi = ?, qaror_sanasi = ? WHERE id = ?",
      [qaror, JSON.stringify(yakuniy), foydalanuvchi, vaqt, t.id],
    );
  }
}

// ------------------------------------------------------------------ AI–tadqiqotchi mosligi

export interface MoslikQatori {
  kalit: string;
  /** «maydon» — sarlavha turi, muvofiqlik, kompozitsiya; «kategoriya» — belgi kategoriyasi */
  tur: "maydon" | "sarlavhaTuri" | "kategoriya" | "jami";
  n: number;
  mos: number | null;
  kappa: number | null;
  talqin: KappaTalqini | null;
}

export interface AiMoslik {
  materiallar: number;
  takliflar: number;
  tasdiqlangan: number;
  ozgartirilgan: number;
  rad: number;
  kutilmoqda: number;
  qatorlar: MoslikQatori[];
  modellar: string[];
  promptlar: string[];
}

const qator = (kalit: string, tur: MoslikQatori["tur"], k: KappaNatija): MoslikQatori => ({
  kalit,
  tur,
  n: k.n,
  mos: k.mos == null ? null : Math.round(k.mos * 1000) / 10,
  kappa: k.kappa == null ? null : Math.round(k.kappa * 1000) / 1000,
  talqin: kappaTalqini(k.kappa),
});

/**
 * Faqat qaror qabul qilingan takliflar bo‘yicha.
 *  - maydonlar: juftlik (AI qiymati, yakuniy qiymat);
 *  - sarlavha turlari: har bir tur uchun «bor/yo‘q» juftliklari;
 *  - belgilar: birliklar — AI taklif qilgan fragmentlar va tadqiqotchining shu materiallardagi barcha belgilari
 *    (bir qismda ustma-ust tushgan fragment — bitta birlik); har bir kategoriya uchun «shu kategoriya / boshqa».
 * Statistikaga kirmaydigan (sun’iy, tekshirilmagan) materiallar hisobga olinmaydi.
 */
export async function aiMoslik(hisobgaShart: string): Promise<AiMoslik> {
  const rows = await all<{
    material_id: number; blok: string; taklif_qiymati: string; yakuniy_qaror: Qaror | null; yakuniy_qiymat: string | null; model: string; prompt_versiya: string;
  }>(
    `SELECT t.material_id, t.blok, t.taklif_qiymati, t.yakuniy_qaror, t.yakuniy_qiymat, t.model, t.prompt_versiya
     FROM ai_takliflar t JOIN materiallar m ON m.id = t.material_id WHERE ${hisobgaShart} ORDER BY t.id`,
  );
  const qarorli = rows.filter((r) => r.yakuniy_qaror);
  const qatorlar: MoslikQatori[] = [];

  for (const blok of ["sar_lid", "lid_matn", "sar_matn", "kompozitsiya"]) {
    const juft = qarorli
      .filter((r) => r.blok === blok && r.yakuniy_qiymat && JSON.parse(r.yakuniy_qiymat) != null)
      .map((r) => [String(JSON.parse(r.taklif_qiymati)), String(JSON.parse(r.yakuniy_qiymat!))] as [string, string]);
    if (juft.length) qatorlar.push(qator(blok, "maydon", cohenKappa(juft)));
  }

  const turlar = qarorli.filter((r) => r.blok === "sarlavha_turlari");
  if (turlar.length) {
    const hammasi = new Set<string>();
    const juftlar = turlar.map((r) => {
      const a = new Set(JSON.parse(r.taklif_qiymati) as string[]);
      const b = new Set((r.yakuniy_qiymat ? (JSON.parse(r.yakuniy_qiymat) as string[] | null) : null) ?? []);
      [...a, ...b].forEach((x) => hammasi.add(x));
      return { a, b };
    });
    for (const tur of [...hammasi].sort()) {
      qatorlar.push(qator(tur, "sarlavhaTuri", cohenKappa(juftlar.map(({ a, b }) => [a.has(tur) ? "1" : "0", b.has(tur) ? "1" : "0"]))));
    }
  }

  // belgilar
  const belgiMateriallar = [...new Set(qarorli.filter((r) => r.blok === "belgi").map((r) => r.material_id))];
  const birliklar: [string, string][] = [];
  for (const mid of belgiMateriallar) {
    const ai = qarorli
      .filter((r) => r.material_id === mid && r.blok === "belgi")
      .map((r) => JSON.parse(r.taklif_qiymati) as { kategoriya: string; qism: string; fragment: string });
    const yakuniy = await all<{ kategoriya: string; qism: string; fragment: string | null }>(
      "SELECT kategoriya, qism, fragment FROM belgilar WHERE material_id = ?",
      [mid],
    );
    const ishlatilgan = new Set<number>();
    const ustma = (x: string, y: string) => {
      const a = norm(x).toLocaleLowerCase();
      const b = norm(y).toLocaleLowerCase();
      return !!a && !!b && (a.includes(b) || b.includes(a));
    };
    for (const a of ai) {
      const i = yakuniy.findIndex((f, j) => !ishlatilgan.has(j) && f.qism === a.qism && ustma(f.fragment ?? "", a.fragment));
      if (i >= 0) ishlatilgan.add(i);
      birliklar.push([a.kategoriya, i >= 0 ? yakuniy[i].kategoriya : "—"]);
    }
    yakuniy.forEach((f, j) => {
      if (!ishlatilgan.has(j)) birliklar.push(["—", f.kategoriya]);
    });
  }
  if (birliklar.length) {
    const kategoriyalar = [...new Set(birliklar.flat().filter((k) => k !== "—"))].sort();
    for (const k of kategoriyalar) {
      qatorlar.push(qator(k, "kategoriya", cohenKappa(birliklar.map(([a, b]) => [a === k ? "1" : "0", b === k ? "1" : "0"]))));
    }
    qatorlar.push(qator("belgilar", "jami", cohenKappa(birliklar)));
  }

  return {
    materiallar: new Set(rows.map((r) => r.material_id)).size,
    takliflar: rows.length,
    tasdiqlangan: rows.filter((r) => r.yakuniy_qaror === "tasdiqlangan").length,
    ozgartirilgan: rows.filter((r) => r.yakuniy_qaror === "ozgartirilgan").length,
    rad: rows.filter((r) => r.yakuniy_qaror === "rad").length,
    kutilmoqda: rows.filter((r) => !r.yakuniy_qaror).length,
    qatorlar,
    modellar: [...new Set(rows.map((r) => r.model))],
    promptlar: [...new Set(rows.map((r) => r.prompt_versiya))],
  };
}

/**
 * Tahlilni saqlash va ko‘rib chiqilgan AI takliflari bo‘yicha qarorlarni yozish — bitta tranzaksiyada.
 * Belgi taklifga bog‘langan bo‘lsa, payload’da ai_taklif_id keladi.
 */
export async function tahlilniSaqlashAi(materialId: number, data: TahlilSaqlash & { ai_qarorlar?: unknown }, foydalanuvchi: string | null) {
  return await transaction(async () => {
    const natija = await tahlilSaqlash(materialId, data, foydalanuvchi);
    const qarorlar = (Array.isArray(data.ai_qarorlar) ? data.ai_qarorlar : [])
      .map((q) => q as { id?: unknown; qaror?: unknown })
      .filter((q) => Number.isInteger(Number(q.id)) && ["tasdiqlangan", "ozgartirilgan", "rad"].includes(String(q.qaror)))
      .map((q) => ({ id: Number(q.id), qaror: q.qaror as Qaror }));
    if (qarorlar.length) {
      const t = await one<Record<string, unknown>>("SELECT * FROM tahlillar WHERE material_id = ?", [materialId]);
      const tahlil = Object.fromEntries(
        MAYDON_BLOKLARI.map((k) => [k, k === "sarlavha_turlari" ? JSON.parse(String(t?.sarlavha_turlari ?? "[]")) : (t?.[k] ?? null)]),
      ) as Record<MaydonBloki, unknown>;
      const bog = new Map<number, Belgi>();
      for (const b of data.belgilar ?? []) {
        const id = Number((b as { ai_taklif_id?: unknown }).ai_taklif_id);
        if (Number.isInteger(id) && id > 0) bog.set(id, b as Belgi);
      }
      await aiQarorlariniYozish(materialId, qarorlar, tahlil, bog, foydalanuvchi);
    }
    return natija;
  });
}
