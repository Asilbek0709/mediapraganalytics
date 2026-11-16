/**
 * Kodlash ishonchliligi: bir materialni bir nechta baholovchi (tadqiqotchi va
 * ekspertlar) mustaqil tahlil qilganda ularning kelishuvi.
 *
 * Har bir ko‘rsatkich o‘z o‘lchov darajasida baholanadi:
 *   muvofiqlik, kompozitsiya, auditoriya — ordinal;
 *   sarlavha turlari — nominal (har bir tur «bor / yo‘q» birligi sifatida);
 *   belgilar soni, K1–K5, LPSI — interval.
 *
 * Natijada matn emas, kodlar qaytariladi — nomlar foydalanuvchi tilida
 * lib/kelishuvNomlari.ts orqali yasaladi.
 */
import { all, hisobgaShart } from "./db.ts";
import { materialOlish } from "./queries.ts";
import { daraja as darajaTopish, metodikaniYuklash } from "./scoring.ts";
import {
  alphaTalqini,
  foizKelishuv,
  krippendorffAlpha,
  ortachaFarq,
  sd,
  type AlphaTalqini,
  type OlchovDarajasi,
  type Qiymat,
} from "./statistika.ts";
import type { Material } from "./types.ts";

export type KelishuvGuruh = "muvofiqlik" | "belgilar" | "ballar" | "muammo" | "vosita" | "turlar";
export type QiymatFormati = "muvofiqlik" | "kompozitsiya" | "son" | "ball" | "bor";

interface Kodlash {
  material_id: number;
  kalit: string;
  nomi: string;
  sar_lid: string | null;
  lid_matn: string | null;
  sar_matn: string | null;
  kompozitsiya: string | null;
  auditoriya: number | null;
  sarlavha_turlari: string[];
  sanoq: Record<string, number>;
  k1: number | null;
  k2: number | null;
  k3: number | null;
  k4: number | null;
  k5: number | null;
  lpsi: number | null;
}

type TahlilQatori = Omit<Kodlash, "kalit" | "nomi" | "sarlavha_turlari" | "sanoq"> & {
  sarlavha_turlari: string;
};

async function kodlashlar(asosiyniQoshish: boolean, materialId?: number): Promise<Kodlash[]> {
  const shart = materialId ? " WHERE material_id = ?" : "";
  const p = materialId ? [materialId] : [];
  const natija: Kodlash[] = [];

  if (asosiyniQoshish) {
    const sanoq = new Map<number, Record<string, number>>();
    for (const r of await all<{ material_id: number; kategoriya: string; soni: number }>(
      `SELECT material_id, kategoriya, COUNT(*) AS soni FROM belgilar${shart} GROUP BY material_id, kategoriya`,
      p,
    )) {
      sanoq.set(r.material_id, { ...(sanoq.get(r.material_id) ?? {}), [r.kategoriya]: r.soni });
    }
    for (const t of await all<TahlilQatori>(`SELECT * FROM tahlillar${shart}`, p)) {
      natija.push({
        ...t,
        kalit: "asosiy",
        nomi: "",
        sarlavha_turlari: JSON.parse(t.sarlavha_turlari || "[]"),
        sanoq: sanoq.get(t.material_id) ?? {},
      });
    }
  }

  const eSanoq = new Map<number, Record<string, number>>();
  for (const r of await all<{ id: number; kategoriya: string; soni: number }>(
    `SELECT ekspert_tahlil_id AS id, kategoriya, COUNT(*) AS soni FROM ekspert_belgilari
     GROUP BY ekspert_tahlil_id, kategoriya`,
  )) {
    eSanoq.set(r.id, { ...(eSanoq.get(r.id) ?? {}), [r.kategoriya]: r.soni });
  }
  for (const t of await all<TahlilQatori & { id: number; ekspert_id: number; ism: string }>(
    `SELECT et.*, e.ism FROM ekspert_tahlillari et JOIN ekspertlar e ON e.id = et.ekspert_id
     ${materialId ? "WHERE et.material_id = ?" : ""} ORDER BY e.id`,
    p,
  )) {
    natija.push({
      ...t,
      kalit: `e${t.ekspert_id}`,
      nomi: t.ism,
      sarlavha_turlari: JSON.parse(t.sarlavha_turlari || "[]"),
      sanoq: eSanoq.get(t.id) ?? {},
    });
  }
  // sun’iy va tekshirilmagan materiallar kelishuv hisobiga kirmaydi
  const hisobda = new Set(
    (await all<{ id: number }>(`SELECT m.id FROM materiallar m WHERE ${hisobgaShart("m")}`)).map((r) => r.id),
  );
  return natija.filter((k) => hisobda.has(k.material_id));
}

interface Korsatkich {
  kalit: string;
  guruh: KelishuvGuruh;
  daraja: OlchovDarajasi;
  format: QiymatFormati;
  /** α uchun qiymat (ordinal — tartib raqami) */
  qiymat: (k: Kodlash) => Qiymat | null;
  /** ko‘rsatish uchun xom qiymat (kod yoki son) */
  xom: (k: Kodlash) => string | number | null;
}

async function korsatkichlar() {
  const m = await metodikaniYuklash();
  const tartib = (qiymatlar: Record<string, number>) =>
    new Map(
      Object.entries(qiymatlar)
        .sort((a, b) => a[1] - b[1])
        .map(([kod], i) => [kod, i]),
    );
  const muvTartib = tartib(m.muvofiqlik);
  const kompTartib = tartib(m.kompozitsiya);
  const muammolar = Object.values(m.kategoriyalar).filter((k) => k.guruh === "muammo");
  const vositalar = Object.values(m.kategoriyalar).filter((k) => k.guruh === "vosita");
  const yig = (k: Kodlash, kodlar: { kod: string }[]) => kodlar.reduce((s, x) => s + (k.sanoq[x.kod] ?? 0), 0);

  const muv = (maydon: "sar_lid" | "lid_matn" | "sar_matn"): Korsatkich => ({
    kalit: maydon,
    guruh: "muvofiqlik",
    daraja: "ordinal",
    format: "muvofiqlik",
    qiymat: (k) => (k[maydon] && muvTartib.has(k[maydon]!) ? muvTartib.get(k[maydon]!)! : null),
    xom: (k) => k[maydon],
  });

  const asosiy: Korsatkich[] = [
    muv("sar_lid"),
    muv("lid_matn"),
    muv("sar_matn"),
    {
      kalit: "kompozitsiya",
      guruh: "muvofiqlik",
      daraja: "ordinal",
      format: "kompozitsiya",
      qiymat: (k) => (k.kompozitsiya && kompTartib.has(k.kompozitsiya) ? kompTartib.get(k.kompozitsiya)! : null),
      xom: (k) => k.kompozitsiya,
    },
    {
      kalit: "auditoriya",
      guruh: "muvofiqlik",
      daraja: "ordinal",
      format: "son",
      qiymat: (k) => k.auditoriya,
      xom: (k) => k.auditoriya,
    },
    {
      kalit: "muammo_jami",
      guruh: "belgilar",
      daraja: "interval",
      format: "son",
      qiymat: (k) => yig(k, muammolar),
      xom: (k) => yig(k, muammolar),
    },
    {
      kalit: "vosita_jami",
      guruh: "belgilar",
      daraja: "interval",
      format: "son",
      qiymat: (k) => yig(k, vositalar),
      xom: (k) => yig(k, vositalar),
    },
    ...(["k1", "k2", "k3", "k4", "k5", "lpsi"] as const).map(
      (kod): Korsatkich => ({
        kalit: kod,
        guruh: "ballar",
        daraja: "interval",
        format: "ball",
        qiymat: (k) => k[kod],
        xom: (k) => k[kod],
      }),
    ),
  ];

  const kategoriyalar: Korsatkich[] = Object.values(m.kategoriyalar).map((kat) => ({
    kalit: `kat_${kat.kod}`,
    guruh: kat.guruh === "muammo" ? "muammo" : "vosita",
    daraja: "interval",
    format: "son",
    qiymat: (k) => k.sanoq[kat.kod] ?? 0,
    xom: (k) => k.sanoq[kat.kod] ?? 0,
  }));

  const sarlavhaTurlari = await all<{ kod: string }>("SELECT kod FROM lugat WHERE turkum = 'sarlavha_turi' ORDER BY tartib");
  return { asosiy, kategoriyalar, sarlavhaTurlari, shkala: m.shkala };
}

export interface KelishuvQatori {
  kalit: string;
  guruh: KelishuvGuruh;
  daraja: OlchovDarajasi;
  alpha: number | null;
  talqin: AlphaTalqini | null;
  birliklar: number;
  qiymatlar: number;
  /** juftlarning mos kelish ulushi, % (nominal va ordinal uchun) */
  kelishuv: number | null;
  /** juftlar orasidagi o‘rtacha mutlaq farq (interval uchun) */
  farq: number | null;
}

function qator(
  k: { kalit: string; guruh: KelishuvGuruh; daraja: OlchovDarajasi },
  birliklar: (Qiymat | null)[][],
): KelishuvQatori {
  const a = krippendorffAlpha(birliklar, k.daraja);
  const interval = k.daraja === "interval";
  const kelishuv = interval ? null : foizKelishuv(birliklar);
  const farq = interval ? ortachaFarq(birliklar as (number | null)[][]) : null;
  // Faqat ma’lumot maydonlari — ko‘rsatkichdagi funksiyalar mijoz komponentiga uzatilmaydi
  return {
    kalit: k.kalit,
    guruh: k.guruh,
    daraja: k.daraja,
    alpha: a.alpha == null ? null : Math.round(a.alpha * 1000) / 1000,
    talqin: alphaTalqini(a.alpha),
    birliklar: a.birliklar,
    qiymatlar: a.qiymatlar,
    kelishuv: kelishuv == null ? null : Math.round(kelishuv * 1000) / 10,
    farq: farq == null ? null : Math.round(farq * 10) / 10,
  };
}

export interface KelishuvMateriali {
  id: number;
  sarlavha: string;
  nashr: string;
  baholovchilar: number;
  lpsi_min: number | null;
  lpsi_max: number | null;
}

export interface UmumiyKelishuv {
  asosiy: boolean;
  baholovchilar: number;
  materiallar: number;
  qatorlar: KelishuvQatori[];
  kategoriyalar: KelishuvQatori[];
  royxat: KelishuvMateriali[];
}

export async function umumiyKelishuv(asosiyniQoshish = true): Promise<UmumiyKelishuv> {
  const k = await kodlashlar(asosiyniQoshish);
  const guruhlar = new Map<number, Kodlash[]>();
  for (const x of k) guruhlar.set(x.material_id, [...(guruhlar.get(x.material_id) ?? []), x]);
  const kopli = [...guruhlar.entries()].filter(([, g]) => g.length >= 2);
  const { asosiy, kategoriyalar, sarlavhaTurlari } = await korsatkichlar();

  const qatorlar = asosiy.map((ko) => qator(ko, kopli.map(([, g]) => g.map(ko.qiymat))));
  // Sarlavha turlari: har bir (material × tur) juftligi — bitta «bor/yo‘q» birligi
  const turBirliklari = kopli.flatMap(([, g]) =>
    sarlavhaTurlari.map((t) => g.map((x) => (x.sarlavha_turlari.includes(t.kod) ? 1 : 0))),
  );
  const turlar = qator({ kalit: "sarlavha_turlari", guruh: "muvofiqlik", daraja: "nominal" }, turBirliklari);
  turlar.birliklar = kopli.length; // «birliklar» ustunida materiallar soni ko‘rsatiladi
  qatorlar.splice(5, 0, turlar);

  const materiallar = new Map(
    (await all<{ id: number; sarlavha: string; nashr: string }>(
      "SELECT m.id, m.sarlavha, n.nomi AS nashr FROM materiallar m JOIN nashrlar n ON n.id = m.nashr_id",
    )).map((r) => [r.id, r]),
  );

  return {
    asosiy: asosiyniQoshish,
    baholovchilar: new Set(k.map((x) => x.kalit)).size,
    materiallar: kopli.length,
    qatorlar,
    kategoriyalar: kategoriyalar.map((ko) => qator(ko, kopli.map(([, g]) => g.map(ko.qiymat)))),
    royxat: kopli
      .map(([id, g]) => {
        const lpsilar = g.map((x) => x.lpsi).filter((v): v is number => v != null);
        const mat = materiallar.get(id);
        return {
          id,
          sarlavha: mat?.sarlavha ?? "—",
          nashr: mat?.nashr ?? "—",
          baholovchilar: g.length,
          lpsi_min: lpsilar.length ? Math.min(...lpsilar) : null,
          lpsi_max: lpsilar.length ? Math.max(...lpsilar) : null,
        };
      })
      .sort((a, b) => a.id - b.id),
  };
}

export type QatorHolati = "toliq" | "kopchilik" | "yaqin" | "farq" | "kam";

export interface MaterialQatori {
  kalit: string;
  guruh: KelishuvGuruh;
  daraja: OlchovDarajasi;
  format: QiymatFormati;
  qiymatlar: (string | number | null)[];
  holat: QatorHolati;
  tarqoqlik: { oraliq: number; sd: number | null } | null;
}

export interface MaterialKelishuvi {
  material: Material;
  asosiy: boolean;
  baholovchilar: { kalit: string; nomi: string; havola: string; lpsi: number | null; daraja: string | null }[];
  qatorlar: MaterialQatori[];
}

function holatAniqlash(qiymatlar: Qiymat[], daraja: OlchovDarajasi, shkala100: boolean): QatorHolati {
  if (qiymatlar.length < 2) return "kam";
  if (daraja === "interval") {
    const sonlar = qiymatlar.map(Number);
    const oraliq = Math.max(...sonlar) - Math.min(...sonlar);
    if (oraliq === 0) return "toliq";
    return oraliq <= (shkala100 ? 10 : 1) ? "yaqin" : "farq";
  }
  const sanoq = new Map<Qiymat, number>();
  for (const v of qiymatlar) sanoq.set(v, (sanoq.get(v) ?? 0) + 1);
  const eng = Math.max(...sanoq.values());
  if (eng === qiymatlar.length) return "toliq";
  return eng > qiymatlar.length / 2 ? "kopchilik" : "farq";
}

export async function materialKelishuvi(materialId: number, asosiyniQoshish = true): Promise<MaterialKelishuvi> {
  const material = await materialOlish(materialId);
  const k = await kodlashlar(asosiyniQoshish, materialId);
  const { asosiy, kategoriyalar, sarlavhaTurlari, shkala } = await korsatkichlar();

  const qatorYasash = (ko: Korsatkich): MaterialQatori => {
    const qiymatlar = k.map(ko.qiymat).filter((v): v is Qiymat => v != null);
    let tarqoqlik: MaterialQatori["tarqoqlik"] = null;
    if (ko.daraja === "interval" && qiymatlar.length >= 2) {
      const sonlar = qiymatlar.map(Number);
      const s = sd(sonlar);
      tarqoqlik = {
        oraliq: Math.round((Math.max(...sonlar) - Math.min(...sonlar)) * 10) / 10,
        sd: s == null ? null : Math.round(s * 10) / 10,
      };
    }
    return {
      kalit: ko.kalit,
      guruh: ko.guruh,
      daraja: ko.daraja,
      format: ko.format,
      qiymatlar: k.map(ko.xom),
      holat: holatAniqlash(qiymatlar, ko.daraja, ko.guruh === "ballar"),
      tarqoqlik,
    };
  };

  const turlarQatorlari: MaterialQatori[] = sarlavhaTurlari.map((t) => {
    const qiymatlar = k.map((x) => (x.sarlavha_turlari.includes(t.kod) ? 1 : 0));
    return {
      kalit: `tur_${t.kod}`,
      guruh: "turlar",
      daraja: "nominal",
      format: "bor",
      qiymatlar,
      holat: holatAniqlash(qiymatlar, "nominal", false),
      tarqoqlik: null,
    };
  });

  return {
    material,
    asosiy: asosiyniQoshish,
    baholovchilar: k.map((x) => ({
      kalit: x.kalit,
      nomi: x.nomi,
      havola: x.kalit === "asosiy" ? `/tahlil/${materialId}` : `/tahlil/${materialId}?ekspert=${x.kalit.slice(1)}`,
      lpsi: x.lpsi,
      daraja: x.lpsi == null ? null : darajaTopish(x.lpsi, shkala),
    })),
    qatorlar: [...asosiy.map(qatorYasash), ...turlarQatorlari, ...kategoriyalar.map(qatorYasash)],
  };
}
