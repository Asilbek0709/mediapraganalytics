/**
 * Misollar korpusini bazadan yig‘ish va ★ bilan tanlangan misollarni saqlash.
 *
 * Tanlov belgi id’siga emas, (material, kategoriya, qism, fragment) to‘plamiga bog‘lanadi:
 * tahlil qayta saqlanganda belgilar qayta yoziladi, lekin fragment o‘zgarmasa tanlov saqlanib qoladi.
 */
import { all, hozir, one, run } from "./db";
import { JANR_YOQ } from "./format";
import { kontekstAjratish, ustmaUst, type Misol } from "./misollar";
import { ApiError } from "./queries";
import type { Guruh, Kategoriya, MediaTuri, Qism } from "./types";

export interface Korpus {
  misollar: Misol[];
  /** fragmenti ko‘rsatilmagan belgilar (korpusga kirmaydi) */
  fragmentsiz: number;
  kategoriyalar: Kategoriya[];
  nashrlar: { id: number; nomi: string; turi: MediaTuri }[];
  janrlar: string[];
}

interface BelgiQatori {
  id: number;
  material_id: number;
  kategoriya: string;
  qism: Qism;
  fragment: string;
  izoh: string | null;
  kategoriya_nomi: string;
  guruh: Guruh;
  tartib: number;
  nashr_id: number;
  nashr: string;
  turi: MediaTuri;
  sana: string | null;
  janr: string | null;
  sarlavha: string;
  lid: string | null;
  matn: string | null;
  havola: string | null;
  lpsi: number | null;
}

const kalit = (material: number, kategoriya: string, qism: string, fragment: string) =>
  JSON.stringify([material, kategoriya, qism, fragment]);

export function misollarKorpusi(): Korpus {
  const belgilar = all<BelgiQatori>(
    `SELECT b.id, b.material_id, b.kategoriya, b.qism, b.fragment, b.izoh,
            k.nomi AS kategoriya_nomi, k.guruh, k.tartib,
            m.nashr_id, n.nomi AS nashr, n.turi, m.sana, m.janr, m.sarlavha, m.lid, m.matn, m.havola,
            t.lpsi
     FROM belgilar b
     JOIN kategoriyalar k ON k.kod = b.kategoriya
     JOIN materiallar m ON m.id = b.material_id
     JOIN nashrlar n ON n.id = m.nashr_id
     LEFT JOIN tahlillar t ON t.material_id = m.id
     WHERE b.fragment IS NOT NULL AND TRIM(b.fragment) <> ''
     ORDER BY b.id`,
  );
  const fragmentsiz =
    one<{ n: number }>("SELECT COUNT(*) AS n FROM belgilar WHERE fragment IS NULL OR TRIM(fragment) = ''")?.n ?? 0;

  // Ekspertlar: material bo‘yicha nechta mustaqil tahlil va ularning belgilari
  const ekspertSoni = new Map(
    all<{ material_id: number; n: number }>(
      "SELECT material_id, COUNT(*) AS n FROM ekspert_tahlillari GROUP BY material_id",
    ).map((r) => [r.material_id, r.n]),
  );
  const ekspertBelgilari = new Map<string, { ekspert_id: number; fragment: string | null }[]>();
  for (const r of all<{ material_id: number; ekspert_id: number; kategoriya: string; qism: string; fragment: string | null }>(
    `SELECT et.material_id, et.ekspert_id, eb.kategoriya, eb.qism, eb.fragment
     FROM ekspert_belgilari eb JOIN ekspert_tahlillari et ON et.id = eb.ekspert_tahlil_id`,
  )) {
    const k = JSON.stringify([r.material_id, r.kategoriya, r.qism]);
    ekspertBelgilari.set(k, [...(ekspertBelgilari.get(k) ?? []), { ekspert_id: r.ekspert_id, fragment: r.fragment }]);
  }

  const tanlanganlar = new Set(
    all<{ material_id: number; kategoriya: string; qism: string; fragment: string }>(
      "SELECT material_id, kategoriya, qism, fragment FROM tanlangan_misollar",
    ).map((r) => kalit(r.material_id, r.kategoriya, r.qism, r.fragment)),
  );

  const misollar: Misol[] = belgilar.map((b) => {
    const qismMatni = b.qism === "sarlavha" ? b.sarlavha : b.qism === "lid" ? b.lid : b.matn;
    const fragment = b.fragment.trim();
    const tasdiqlaganlar = new Set(
      (ekspertBelgilari.get(JSON.stringify([b.material_id, b.kategoriya, b.qism])) ?? [])
        .filter((e) => ustmaUst(fragment, e.fragment, qismMatni))
        .map((e) => e.ekspert_id),
    );
    return {
      id: b.id,
      material_id: b.material_id,
      nashr_id: b.nashr_id,
      nashr: b.nashr,
      turi: b.turi,
      sana: b.sana,
      janr: b.janr && b.janr.trim() ? b.janr : JANR_YOQ,
      sarlavha: b.sarlavha,
      havola: b.havola,
      kategoriya: b.kategoriya,
      kategoriya_nomi: b.kategoriya_nomi,
      guruh: b.guruh,
      tartib: b.tartib,
      qism: b.qism,
      fragment,
      izoh: b.izoh,
      kontekst: kontekstAjratish(qismMatni, fragment),
      toliq: b.lpsi != null,
      ekspertlar: ekspertSoni.get(b.material_id) ?? 0,
      tasdiq: tasdiqlaganlar.size,
      tanlangan: tanlanganlar.has(kalit(b.material_id, b.kategoriya, b.qism, b.fragment)),
    };
  });

  return {
    misollar,
    fragmentsiz,
    kategoriyalar: all<Kategoriya>("SELECT * FROM kategoriyalar ORDER BY tartib"),
    nashrlar: all<{ id: number; nomi: string; turi: MediaTuri }>("SELECT id, nomi, turi FROM nashrlar ORDER BY turi, nomi"),
    janrlar: [...new Set(misollar.map((m) => m.janr))].sort(),
  };
}

/** ★ belgisini qo‘yish yoki olib tashlash. Faqat mavjud belgi uchun. */
export function misolniTanlash(data: unknown) {
  const d = (data ?? {}) as Record<string, unknown>;
  const material = Number(d.material_id);
  const kategoriya = typeof d.kategoriya === "string" ? d.kategoriya : "";
  const qism = typeof d.qism === "string" ? d.qism : "";
  const fragment = typeof d.fragment === "string" ? d.fragment : "";
  const tanlangan = d.tanlangan === true;
  if (!Number.isInteger(material) || material <= 0 || !kategoriya || !qism || !fragment) {
    throw new ApiError(422, "x.misolTopilmadi");
  }
  // Belgilar TRIM qilingan holda saqlanadi, lekin eski yozuvlar uchun ham TRIM bilan solishtiriladi
  const belgi = one<{ fragment: string }>(
    "SELECT fragment FROM belgilar WHERE material_id = ? AND kategoriya = ? AND qism = ? AND TRIM(fragment) = ? LIMIT 1",
    [material, kategoriya, qism, fragment.trim()],
  );
  if (!belgi) throw new ApiError(404, "x.misolTopilmadi");

  if (tanlangan) {
    run(
      `INSERT INTO tanlangan_misollar (material_id, kategoriya, qism, fragment, yaratilgan) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT DO NOTHING`,
      [material, kategoriya, qism, belgi.fragment, hozir()],
    );
  } else {
    run("DELETE FROM tanlangan_misollar WHERE material_id = ? AND kategoriya = ? AND qism = ? AND TRIM(fragment) = ?", [
      material,
      kategoriya,
      qism,
      fragment.trim(),
    ]);
  }
  return { tanlangan };
}
