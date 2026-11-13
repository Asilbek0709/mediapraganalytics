/**
 * Metodikaning boshlang‘ich qiymatlari.
 *
 * I bob — nazariy kategoriyalar, II bob — tahlil bloklari,
 * III bob — baholash mezonlari, vaznlar va interpretatsiya shkalasi.
 *
 * Qiymatlar faqat baza birinchi marta yaratilganda yoziladi; keyin ular
 * «Metodika» sahifasidan o‘zgartiriladi.
 */

export type Guruh = "muammo" | "vosita";

export const MEZONLAR: [string, string, number, string][] = [
  ["K1", "Pragmatik muvofiqlik", 25,
    "Sarlavha ↔ lid, lid ↔ asosiy matn, sarlavha ↔ asosiy matn munosabatlarining o‘rtachasi"],
  ["K2", "Semantik aniqlik", 25,
    "100 balldan semantik noaniqlik birliklari uchun jarimalar ayiriladi"],
  ["K3", "Lisoniy-uslubiy me’yor", 20,
    "100 balldan lisoniy-uslubiy xatoliklar uchun jarimalar ayiriladi"],
  ["K4", "Kompozitsion yaxlitlik", 15,
    "Kompozitsiya turiga berilgan ball"],
  ["K5", "Auditoriya uchun aniqlik", 15,
    "Ekspert bahosi (1–5) 0–100 shkalaga o‘tkaziladi, kontekstual nomuvofiqlik uchun jarima ayiriladi"],
];

export const KATEGORIYALAR: [string, string, Guruh, string | null, number][] = [
  ["abstrakt_jumla", "Abstrakt jumla", "muammo", "K2", 10],
  ["semantik_noaniqlik", "Semantik noaniqlik", "muammo", "K2", 10],
  ["referensial_noaniqlik", "Referensial noaniqlik", "muammo", "K2", 10],
  ["mantiqiy_noaniqlik", "Mantiqiy noaniqlik", "muammo", "K2", 10],
  ["interpretativ_noaniqlik", "Interpretativ noaniqlik", "muammo", "K2", 10],
  ["uslubiy_xatolik", "Lisoniy-uslubiy xatolik", "muammo", "K3", 10],
  ["kontekstual_nomuvofiqlik", "Kontekstual nomuvofiqlik", "muammo", "K5", 10],
  ["baholovchi_birlik", "Baholovchi birlik", "vosita", null, 0],
  ["modal_birlik", "Modal birlik", "vosita", null, 0],
  ["murojaat", "Murojaat", "vosita", null, 0],
  ["chaqiriq", "Chaqiriq", "vosita", null, 0],
];

export const LUGAT: Record<string, [string, string, number | null][]> = {
  sarlavha_turi: [
    ["axborotiy", "Axborotiy", null],
    ["baholovchi", "Baholovchi", null],
    ["emotsional", "Emotsional", null],
    ["savol", "Savol shaklida", null],
    ["chaqiriqli", "Chaqiriqli", null],
    ["metaforik", "Metaforik", null],
    ["abstrakt", "Abstrakt", null],
    ["pragmatik_nomutanosib", "Pragmatik nomutanosib", null],
  ],
  muvofiqlik: [
    ["mos", "Mos", 1],
    ["qisman", "Qisman mos", 0.5],
    ["mos_emas", "Mos emas", 0],
  ],
  kompozitsiya: [
    ["mantiqiy", "Mantiqiy", 100],
    ["ketma_ket", "Ketma-ket", 80],
    ["aralash", "Aralash", 60],
    ["buzilgan", "Axborot ierarxiyasi buzilgan", 30],
  ],
  janr: [
    ["maqola", "maqola", null],
    ["xabar", "xabar", null],
    ["intervyu", "intervyu", null],
    ["reportaj", "reportaj", null],
    ["sharh", "sharh", null],
    ["lavha", "lavha", null],
  ],
};

export const SHKALA = [
  { gacha: 40, nomi: "past" },
  { gacha: 60, nomi: "qoniqarli" },
  { gacha: 80, nomi: "yaxshi" },
  { gacha: 100, nomi: "yuqori" },
];

export const NASHRLAR: [string, "bosma" | "raqamli"][] = [
  ["Sharq yulduzi", "bosma"],
  ["Adolat", "bosma"],
  ["Jadid", "bosma"],
  ["Kun.uz", "raqamli"],
  ["Qalampir.uz", "raqamli"],
  ["Oyina.uz", "raqamli"],
];
