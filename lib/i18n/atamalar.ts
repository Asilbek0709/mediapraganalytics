/**
 * Metodika atamalari (mezonlar, kategoriyalar, lug‘at, daraja) tarjimasi.
 *
 * Atamalar bazada o‘zbekcha saqlanadi. Tarjima kod bo‘yicha olinadi — lekin faqat
 * nom boshlang‘ich (seed) nomga teng bo‘lsa. Tadqiqotchi «Metodika»da nomni o‘zgartirgan
 * bo‘lsa, uning nomi o‘zgarishsiz ko‘rsatiladi.
 */
import { KATEGORIYALAR, LUGAT, MEZONLAR, SHKALA } from "../seed.ts";
import type { Til } from "./til.ts";

type Tarjima = Partial<Record<Exclude<Til, "uz">, string>>;

const MEZON: Record<string, Tarjima> = {
  K1: { ru: "Прагматическое соответствие", en: "Pragmatic coherence" },
  K2: { ru: "Семантическая точность", en: "Semantic precision" },
  K3: { ru: "Языковая и стилистическая норма", en: "Linguistic and stylistic norm" },
  K4: { ru: "Композиционная целостность", en: "Compositional integrity" },
  K5: { ru: "Понятность для аудитории", en: "Clarity for the audience" },
};

const MEZON_TAVSIF: Record<string, Tarjima> = {
  K1: {
    ru: "Среднее трёх связей: заголовок ↔ лид, лид ↔ основной текст, заголовок ↔ основной текст",
    en: "Average of three relations: headline ↔ lead, lead ↔ body text, headline ↔ body text",
  },
  K2: {
    ru: "Из 100 баллов вычитаются штрафы за единицы семантической неточности",
    en: "Penalties for units of semantic imprecision are subtracted from 100 points",
  },
  K3: {
    ru: "Из 100 баллов вычитаются штрафы за языковые и стилистические ошибки",
    en: "Penalties for linguistic and stylistic errors are subtracted from 100 points",
  },
  K4: { ru: "Балл за тип композиции", en: "Score assigned to the composition type" },
  K5: {
    ru: "Экспертная оценка (1–5) переводится в шкалу 0–100, вычитаются штрафы за контекстуальное несоответствие",
    en: "Expert rating (1–5) is converted to a 0–100 scale; penalties for contextual mismatch are subtracted",
  },
};

const KATEGORIYA: Record<string, Tarjima> = {
  abstrakt_jumla: { ru: "Абстрактная фраза", en: "Abstract statement" },
  semantik_noaniqlik: { ru: "Семантическая неточность", en: "Semantic ambiguity" },
  referensial_noaniqlik: { ru: "Референциальная неточность", en: "Referential ambiguity" },
  mantiqiy_noaniqlik: { ru: "Логическая неточность", en: "Logical inconsistency" },
  interpretativ_noaniqlik: { ru: "Интерпретативная неоднозначность", en: "Interpretive ambiguity" },
  uslubiy_xatolik: { ru: "Языковая или стилистическая ошибка", en: "Linguistic or stylistic error" },
  kontekstual_nomuvofiqlik: { ru: "Контекстуальное несоответствие", en: "Contextual mismatch" },
  baholovchi_birlik: { ru: "Оценочная единица", en: "Evaluative unit" },
  modal_birlik: { ru: "Модальная единица", en: "Modal unit" },
  murojaat: { ru: "Обращение", en: "Direct address" },
  chaqiriq: { ru: "Призыв", en: "Call to action" },
};

const LUGAT_TARJIMA: Record<string, Record<string, Tarjima>> = {
  sarlavha_turi: {
    axborotiy: { ru: "Информационный", en: "Informative" },
    baholovchi: { ru: "Оценочный", en: "Evaluative" },
    emotsional: { ru: "Эмоциональный", en: "Emotional" },
    savol: { ru: "В форме вопроса", en: "Question" },
    chaqiriqli: { ru: "Призывный", en: "Call to action" },
    metaforik: { ru: "Метафорический", en: "Metaphorical" },
    abstrakt: { ru: "Абстрактный", en: "Abstract" },
    pragmatik_nomutanosib: { ru: "Прагматически несогласованный", en: "Pragmatically incongruent" },
  },
  muvofiqlik: {
    mos: { ru: "Соответствует", en: "Consistent" },
    qisman: { ru: "Частично", en: "Partly" },
    mos_emas: { ru: "Не соответствует", en: "Inconsistent" },
  },
  kompozitsiya: {
    mantiqiy: { ru: "Логическая", en: "Logical" },
    ketma_ket: { ru: "Последовательная", en: "Sequential" },
    aralash: { ru: "Смешанная", en: "Mixed" },
    buzilgan: { ru: "Нарушена иерархия информации", en: "Broken information hierarchy" },
  },
  janr: {
    maqola: { ru: "статья", en: "article" },
    xabar: { ru: "новость", en: "news" },
    intervyu: { ru: "интервью", en: "interview" },
    reportaj: { ru: "репортаж", en: "report" },
    sharh: { ru: "комментарий", en: "commentary" },
    lavha: { ru: "очерк", en: "sketch" },
  },
};

const DARAJA: Record<string, Tarjima> = {
  past: { ru: "низкий", en: "low" },
  qoniqarli: { ru: "удовлетворительный", en: "satisfactory" },
  yaxshi: { ru: "хороший", en: "good" },
  yuqori: { ru: "высокий", en: "high" },
};

// Boshlang‘ich (seed) nomlar — ular bilan solishtirib, nom o‘zgartirilganmi-yo‘qmi aniqlanadi
const ASL_MEZON = Object.fromEntries(MEZONLAR.map(([kod, nomi]) => [kod, nomi]));
const ASL_TAVSIF = Object.fromEntries(MEZONLAR.map(([kod, , , tavsif]) => [kod, tavsif]));
const ASL_KATEGORIYA = Object.fromEntries(KATEGORIYALAR.map(([kod, nomi]) => [kod, nomi]));
const ASL_LUGAT: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries(LUGAT).map(([turkum, q]) => [turkum, Object.fromEntries(q.map(([kod, nomi]) => [kod, nomi]))]),
);
const ASL_DARAJA = new Set(SHKALA.map((s) => s.nomi));
const JANR_KOD = Object.fromEntries(LUGAT.janr.map(([kod, nomi]) => [nomi, kod]));

export interface Atamalar {
  mezon: (kod: string, nomi?: string | null) => string;
  mezonTavsif: (kod: string, tavsif?: string | null) => string;
  kategoriya: (kod: string, nomi?: string | null) => string;
  lugat: (turkum: string, kod: string, nomi?: string | null) => string;
  daraja: (nomi: string | null | undefined) => string;
  janr: (nomi: string | null | undefined) => string;
}

export function atamalar(til: Til): Atamalar {
  const tanlash = (tarjima: Tarjima | undefined, asl: string | undefined, bazadagi?: string | null): string => {
    const nom = bazadagi ?? asl ?? "";
    if (til === "uz") return nom;
    if (bazadagi != null && asl != null && bazadagi !== asl) return bazadagi; // tadqiqotchi o‘zgartirgan
    return tarjima?.[til] ?? nom;
  };
  return {
    mezon: (kod, nomi) => tanlash(MEZON[kod], ASL_MEZON[kod], nomi),
    mezonTavsif: (kod, tavsif) => tanlash(MEZON_TAVSIF[kod], ASL_TAVSIF[kod], tavsif),
    kategoriya: (kod, nomi) => tanlash(KATEGORIYA[kod], ASL_KATEGORIYA[kod], nomi),
    lugat: (turkum, kod, nomi) => tanlash(LUGAT_TARJIMA[turkum]?.[kod], ASL_LUGAT[turkum]?.[kod], nomi),
    daraja: (nomi) => {
      if (!nomi) return "";
      if (til === "uz" || !ASL_DARAJA.has(nomi)) return nomi;
      return DARAJA[nomi]?.[til] ?? nomi;
    },
    janr: (nomi) => {
      if (!nomi) return "";
      const kod = JANR_KOD[nomi];
      if (til === "uz" || !kod) return nomi;
      return LUGAT_TARJIMA.janr[kod]?.[til] ?? nomi;
    },
  };
}
