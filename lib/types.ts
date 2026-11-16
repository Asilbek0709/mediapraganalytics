import type { ManbaTuri } from "./manba.ts";

/** Platformaning umumiy tiplari (server va mijoz uchun). */

export type MediaTuri = "bosma" | "raqamli";
export type Qism = "sarlavha" | "lid" | "matn";
export type Guruh = "muammo" | "vosita";
export type Holat = "tahlil_qilingan" | "toliq_emas" | "tahlil_qilinmagan";

export interface Nashr {
  id: number;
  nomi: string;
  turi: MediaTuri;
  materiallar_soni?: number;
}

export interface Kategoriya {
  kod: string;
  nomi: string;
  guruh: Guruh;
  mezon: string | null;
  jarima: number;
  tartib: number;
}

export interface Mezon {
  kod: string;
  nomi: string;
  vazn: number;
  tavsif: string | null;
}

export interface ShkalaOraliq {
  gacha: number;
  nomi: string;
}

export interface LugatYozuv {
  kod: string;
  nomi: string;
  qiymat: number | null;
}

export interface Metodika {
  versiya: number;
  vaznlar: Record<string, number>;
  muvofiqlik: Record<string, number>;
  kompozitsiya: Record<string, number>;
  kategoriyalar: Record<string, Kategoriya>;
  shkala: ShkalaOraliq[];
}

/** «Metodika» sahifasi uchun to‘liq ma’lumot */
export interface MetodikaTolik {
  versiya: number;
  mezonlar: Mezon[];
  kategoriyalar: Kategoriya[];
  lugat: Record<string, LugatYozuv[]>;
  shkala: ShkalaOraliq[];
  janrlar: string[];
  tahlillar_soni: number;
}

export interface MetodikaTarix {
  versiya: number;
  sana: string;
  izoh: string | null;
  /** kim o‘zgartirgan (eski versiyalarda — yo‘q) */
  muallif?: string | null;
  snapshot: Partial<Metodika>;
}

export interface Material {
  id: number;
  nashr_id: number;
  nashr: string;
  turi: MediaTuri;
  sana: string | null;
  janr: string | null;
  mavzu: string | null;
  havola: string | null;
  sarlavha: string;
  lid: string | null;
  matn: string | null;
  yaratilgan?: string;
  yangilangan?: string;
  lpsi: number | null;
  daraja: string | null;
  tahlil_bor: number;
  /** qayerdan olingan: qo‘lda, havola, pdf, ocr, import, sun’iy */
  manba_turi: ManbaTuri;
  /** havoladan yuklangan vaqt */
  olingan_sana: string | null;
  matn_hash: string | null;
  /** tadqiqotchi tekshirganmi (OCR natijasi) — tekshirilmagan material tahlil va statistikaga kirmaydi */
  tekshirilgan: boolean;
  /** asl HTML nusxasi saqlanganmi */
  arxiv_bor?: boolean;
}

export interface Belgi {
  id?: number;
  kategoriya: string;
  qism: Qism;
  fragment: string | null;
  izoh: string | null;
}

export interface TahlilKirish {
  sarlavha_turlari?: string[] | string;
  kompozitsiya?: string | null;
  sar_lid?: string | null;
  lid_matn?: string | null;
  sar_matn?: string | null;
  auditoriya?: number | null;
  izoh?: string | null;
}

export interface Tahlil extends TahlilKirish {
  material_id: number;
  sarlavha_turlari: string[];
  k1: number | null;
  k2: number | null;
  k3: number | null;
  k4: number | null;
  k5: number | null;
  lpsi: number | null;
  daraja: string | null;
  metodika_versiya: number | null;
  yangilangan: string;
}

export interface IzohJarima {
  kategoriya: string;
  soni: number;
  jarima: number;
}

/** Mezon balli qanday hisoblangani — matn tarjimada yig‘iladi (lib/i18n). */
export type MezonIzohi =
  | { tur: "k1"; qiymatlar: number[]; jarimalar: IzohJarima[]; ball: number; xom: number }
  | { tur: "yuz"; jarimalar: IzohJarima[]; ball: number; xom: number }
  | { tur: "k4"; asos: number; jarimalar: IzohJarima[]; ball: number; xom: number }
  | { tur: "k5"; auditoriya: number; jarimalar: IzohJarima[]; ball: number; xom: number };

export type Yetishmaydi = "sar_lid" | "lid_matn" | "sar_matn" | "kompozitsiya" | "auditoriya";

export interface Natija {
  toliq: boolean;
  yetishmaydi: Yetishmaydi[];
  izohlar: Partial<Record<string, MezonIzohi | null>>;
  metodika_versiya: number;
  k1: number | null;
  k2: number | null;
  k3: number | null;
  k4: number | null;
  k5: number | null;
  lpsi: number | null;
  daraja: string | null;
}

/** Guruh kesimi: nashr, media turi yoki janr bo‘yicha o‘rtacha ko‘rsatkichlar */
export interface Kesim {
  nomi: string;
  media_turi?: MediaTuri;
  soni: number;
  k1: number | null;
  k2: number | null;
  k3: number | null;
  k4: number | null;
  k5: number | null;
  lpsi: number | null;
  daraja: string | null;
  ulushlar: Record<string, number>;
}

export interface MuammoChastota {
  kod: string;
  nomi: string;
  guruh: Guruh;
  mezon: string | null;
  birliklar: number;
  materiallar: number;
  ulush: number;
  qismlar: Record<Qism, number>;
}

export interface Dashboard {
  jami: number;
  tahlil_qilingan: number;
  toliq_emas: number;
  tahlil_kutmoqda: number;
  /** statistikadan tashqaridagi (tekshirilmagan yoki sun’iy) materiallar soni */
  chetda: number;
  nashrlar_soni: number;
  ortacha_lpsi: number | null;
  ortacha_daraja: string | null;
  taqsimot: { nomi: string; gacha: number; quyi: number; soni: number }[];
  nashrlar: Kesim[];
  media_turlari: Kesim[];
  janrlar: Kesim[];
  muammolar: MuammoChastota[];
  oxirgi: {
    id: number;
    nashr: string;
    sarlavha: string;
    lpsi: number | null;
    daraja: string | null;
    tahlil_sanasi: string;
  }[];
  metodika_versiya: number;
  shkala: ShkalaOraliq[];
  mezonlar: Mezon[];
}
