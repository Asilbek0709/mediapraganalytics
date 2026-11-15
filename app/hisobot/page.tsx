import Link from "next/link";

import { NashrHisobotKarta } from "@/components/hisobot/NashrHisobotKarta";
import { ZaxiraKarta } from "@/components/hisobot/ZaxiraKarta";
import { Card, CardHead, Stagger } from "@/components/ui/Card";
import { dashboard } from "@/lib/analytics";
import type { Kalit } from "@/lib/i18n";
import { sahifaSarlavhasi, serverTarjimon } from "@/lib/i18n/server";
import { hisobotNashrlari } from "@/lib/nashrHisoboti";
import { zaxiraHolati } from "@/lib/zaxira";
import { sahifaTalab } from "@/lib/sessiya";

export const dynamic = "force-dynamic";

export const generateMetadata = () => sahifaSarlavhasi("nav.hisobot");

const VARAQLAR = [
  "materiallar",
  "tahlil",
  "nashrlar",
  "media",
  "janrlar",
  "reyting",
  "muammolar",
  "sarlavha",
  "dinamika",
  "ahamiyat",
  "kelishuv",
  "vaznlar",
  "metodika",
] as const;

export default async function HisobotSahifasi() {
  const f = await sahifaTalab(["admin", "kuzatuvchi"]);
  const admin = f.rol === "admin";
  const { t } = await serverTarjimon();
  const d = await dashboard();

  return (
    <div className="flex flex-col gap-5">
      <header>
        <div className="eyebrow">{t("hs.eyebrow")}</div>
        <h1 className="mt-1.5">{t("nav.hisobot")}</h1>
        <p className="hint mt-2">{t("hs.izoh")}</p>
      </header>

      <Stagger className="flex flex-col gap-4">
        <Card>
          <CardHead
            title={t("hs.excel")}
            izoh={t("hs.excelIzoh", { n: d.jami, t: d.tahlil_qilingan, v: d.metodika_versiya })}
            ong={
              <a className="btn btn-primary" href="/api/export/excel">
                {t("hs.yuklab")}
              </a>
            }
          />
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t("hs.varaq")}</th>
                  <th>{t("hs.mazmun")}</th>
                </tr>
              </thead>
              <tbody>
                {VARAQLAR.map((v) => (
                  <tr key={v}>
                    <td className="font-bold">{t(`xl.v.${v}` as Kalit)}</td>
                    <td>{t(`hs.m.${v}` as Kalit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint mt-3">{t("hs.tilIzoh")}</p>
        </Card>

        <NashrHisobotKarta nashrlar={await hisobotNashrlari()} />

        <Card>
          <CardHead
            title={t("ms.sarlavha")}
            izoh={t("ms.hs.izoh")}
            ong={
              <Link className="btn" href="/misollar">
                {t("ms.hs.ochish")}
              </Link>
            }
          />
        </Card>

        {admin && (
          <Card>
            <CardHead title={t("hs.pdf")} />
            <p>{t("hs.pdfIzoh")}</p>
          </Card>
        )}

        {admin && <ZaxiraKarta boshHolat={await zaxiraHolati()} />}
      </Stagger>
    </div>
  );
}
