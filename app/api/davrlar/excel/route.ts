import { analitika, filtrniTekshirish } from "@/lib/analitika";
import { davrTaqqoslash, oraliqmi } from "@/lib/davrlar";
import { davrlarExcel } from "@/lib/excel";
import { JANR_YOQ, sana } from "@/lib/format";
import { tarjimon } from "@/lib/i18n";
import { joriyTil } from "@/lib/i18n/server";
import { ApiError } from "@/lib/queries";
import { faylSarlavhasi, xatoJavobi } from "@/lib/route";

export const dynamic = "force-dynamic";

/** Ikki davrni taqqoslash: a_dan, a_gacha, b_dan, b_gacha + Analitika filtrlari (turi, nashr_id, janr, dan, gacha). */
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const filtr = filtrniTekshirish(Object.fromEntries(sp));
    const A = { dan: sp.get("a_dan") ?? "", gacha: sp.get("a_gacha") ?? "" };
    const B = { dan: sp.get("b_dan") ?? "", gacha: sp.get("b_gacha") ?? "" };
    if (!oraliqmi(A) || !oraliqmi(B)) throw new ApiError(422, "dv.notogri");

    const a = analitika(filtr);
    const d = davrTaqqoslash(a.materiallar, A, B, a.muammolar);
    const til = await joriyTil();
    const { t, media, atama } = tarjimon(til);
    const filtrQismlari = [
      filtr.turi ? media(filtr.turi) : null,
      filtr.nashr_id ? (a.tanlovlar.nashrlar.find((n) => n.id === filtr.nashr_id)?.nomi ?? null) : null,
      filtr.janr ? (filtr.janr === JANR_YOQ ? t("u.janrYoq") : atama.janr(filtr.janr)) : null,
      filtr.dan ? `${t("u.sanaDan")} ${sana(filtr.dan)}` : null,
      filtr.gacha ? `${t("u.sanaGacha")} ${sana(filtr.gacha)}` : null,
    ].filter((x): x is string => !!x);

    const { buf, fayl } = await davrlarExcel(til, d, filtrQismlari.length ? filtrQismlari.join("; ") : null);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": faylSarlavhasi("attachment", fayl),
      },
    });
  } catch (e) {
    return xatoJavobi(e);
  }
}
