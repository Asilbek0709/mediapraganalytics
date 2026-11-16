/**
 * Hisobot oxiridagi metodologik izoh (ТЗ v2, 7): materiallar soni, davr, AI yordami ishlatilganmi
 * va AI–tadqiqotchi mosligi. Excel va PDF hisobotlarida bir xil matn.
 */
import { aiMoslik } from "./ai/taklif.ts";
import { hisobgaShart, one } from "./db.ts";
import { sana } from "./format.ts";
import type { Tarjimon } from "./i18n/index.ts";

export interface MetodologikIzoh {
  materiallar: number;
  dan: string | null;
  gacha: string | null;
  /** AI taklifidan olingan (tasdiqlangan yoki o‘zgartirilgan) belgilar */
  aiBelgilar: number;
  aiTakliflar: number;
  /** barcha belgilar bo‘yicha AI–tadqiqotchi mosligi */
  aiMos: number | null;
  aiKappa: number | null;
  aiTalqin: string | null;
}

/** nashrId berilsa — faqat shu nashr materiallari bo‘yicha */
export async function metodologikIzoh(nashrId?: number): Promise<MetodologikIzoh> {
  const shart = `${hisobgaShart("m")}${nashrId ? " AND m.nashr_id = ?" : ""}`;
  const p = nashrId ? [nashrId] : [];
  const r = await one<{ n: number; dan: string | null; gacha: string | null }>(
    `SELECT COUNT(*) AS n, MIN(m.sana) AS dan, MAX(m.sana) AS gacha
     FROM materiallar m JOIN tahlillar t ON t.material_id = m.id WHERE t.lpsi IS NOT NULL AND ${shart}`,
    p,
  );
  const aiB = await one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM belgilar b JOIN materiallar m ON m.id = b.material_id WHERE b.holat <> 'qolda' AND ${shart}`,
    p,
  );
  const ms = await aiMoslik(nashrId ? `${hisobgaShart("m")} AND m.nashr_id = ${Number(nashrId)}` : hisobgaShart("m"));
  const jami = ms.qatorlar.find((q) => q.tur === "jami");
  return {
    materiallar: r?.n ?? 0,
    dan: r?.dan ?? null,
    gacha: r?.gacha ?? null,
    aiBelgilar: aiB?.n ?? 0,
    aiTakliflar: ms.takliflar,
    aiMos: jami?.mos ?? null,
    aiKappa: jami?.kappa ?? null,
    aiTalqin: jami?.talqin ?? null,
  };
}

/** Izoh qatorlari foydalanuvchi tilida */
export function izohQatorlari(m: MetodologikIzoh, tr: Tarjimon): string[] {
  const { t, son } = tr;
  const qatorlar = [t("mi.materiallar", { n: m.materiallar })];
  if (m.dan || m.gacha) qatorlar.push(t("mi.davr", { dan: sana(m.dan), gacha: sana(m.gacha) }));
  if (!m.aiTakliflar && !m.aiBelgilar) qatorlar.push(t("mi.aiYoq"));
  else {
    qatorlar.push(t("mi.aiBor", { b: m.aiBelgilar, n: m.aiTakliflar }));
    if (m.aiKappa != null) {
      qatorlar.push(t("mi.aiMoslik", { m: son(m.aiMos), k: son(m.aiKappa, 3), v: m.aiTalqin ? t(`ai.k.${m.aiTalqin}` as "ai.k.yomon") : "—" }));
    }
  }
  qatorlar.push(t("mi.qoida"));
  return qatorlar;
}

/** Bir nechta qatorni bitta matn sifatida (PDF izohi uchun) */
export const izohMatni = (m: MetodologikIzoh, tr: Tarjimon) => izohQatorlari(m, tr).join(" ");

export async function aiBelgilarSoni(materialId: number): Promise<number> {
  return (await one<{ n: number }>("SELECT COUNT(*) AS n FROM belgilar WHERE material_id = ? AND holat <> 'qolda'", [materialId]))?.n ?? 0;
}


