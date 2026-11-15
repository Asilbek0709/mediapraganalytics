"use client";

import { useState } from "react";

import { useTil } from "@/components/i18n/TilProvider";
import { Card, CardHead } from "@/components/ui/Card";
import type { MediaTuri } from "@/lib/types";

/** Hisobot sahifasi: nashr va (ixtiyoriy) davrni tanlab, redaksion PDF hisobotni ochish. */
export function NashrHisobotKarta({ nashrlar }: { nashrlar: { id: number; nomi: string; turi: MediaTuri; toliq: number }[] }) {
  const { t, media } = useTil();
  const tanlanadigan = nashrlar.filter((n) => n.toliq > 0);
  const [id, setId] = useState<number | "">(tanlanadigan[0]?.id ?? "");
  const [dan, setDan] = useState("");
  const [gacha, setGacha] = useState("");

  const qs = new URLSearchParams(
    Object.entries({ dan, gacha }).filter(([, v]) => v),
  ).toString();
  const href = id === "" ? undefined : `/api/nashrlar/${id}/hisobot${qs ? `?${qs}` : ""}`;
  const notogri = !!dan && !!gacha && dan > gacha;

  return (
    <Card>
      <CardHead title={t("nh.karta")} izoh={t("nh.kartaIzoh")} />
      {tanlanadigan.length === 0 ? (
        <p className="hint">{t("xl.hozirchaYoq")}</p>
      ) : (
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="field">
            <span>{t("u.nashr")}</span>
            <select value={id} onChange={(e) => setId(e.target.value ? Number(e.target.value) : "")}>
              {(["bosma", "raqamli"] as const).map((tur) => (
                <optgroup key={tur} label={media(tur)}>
                  {tanlanadigan
                    .filter((n) => n.turi === tur)
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {t("nh.variant", { v: n.nomi, n: n.toliq })}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t("u.sanaDan")}</span>
            <input type="date" value={dan} onChange={(e) => setDan(e.target.value)} />
          </label>
          <label className="field">
            <span>{t("u.sanaGacha")}</span>
            <input type="date" value={gacha} onChange={(e) => setGacha(e.target.value)} />
          </label>
          <a
            className={`btn btn-primary ${!href || notogri ? "pointer-events-none opacity-50" : ""}`}
            href={href}
            target="_blank"
            rel="noopener"
            aria-disabled={!href || notogri}
          >
            {t("nh.ochish")}
          </a>
        </div>
      )}
      <p className="hint mt-2">{notogri ? t("dv.notogri") : t("nh.davrIxtiyoriy")}</p>
    </Card>
  );
}
