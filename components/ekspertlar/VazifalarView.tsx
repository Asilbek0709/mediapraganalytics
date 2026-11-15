"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useTil } from "@/components/i18n/TilProvider";
import { Card, CardHead } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { api, xatoMatni } from "@/lib/client";
import type { Vazifa } from "@/lib/ekspert";
import { idRaqami, sana } from "@/lib/format";

type Holat = "" | "bor" | "yoq";

/** Ekspertning ish joyi: materiallar ro‘yxati (faqat o‘z tahlili holati) va vaznlar so‘rovi. */
export function VazifalarView({
  ekspert,
  vazifalar,
  vaznlar,
  mezonlar,
}: {
  ekspert: { id: number; ism: string };
  vazifalar: Vazifa[];
  vaznlar: Record<string, number> | null;
  mezonlar: { kod: string; nomi: string; tavsif: string | null }[];
}) {
  const { t, son, atama, media } = useTil();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [holat, setHolat] = useState<Holat>("");
  const [v, setV] = useState<Record<string, string>>(() =>
    Object.fromEntries(mezonlar.map((m) => [m.kod, vaznlar?.[m.kod] != null ? String(vaznlar[m.kod]) : ""])),
  );
  const [band, setBand] = useState(false);

  const bajarilgan = vazifalar.filter((x) => x.bor).length;
  const royxat = useMemo(() => {
    const s = q.trim().toLocaleLowerCase();
    return vazifalar.filter(
      (x) =>
        (!holat || (holat === "bor") === x.bor) &&
        (!s || x.sarlavha.toLocaleLowerCase().includes(s) || x.nashr.toLocaleLowerCase().includes(s)),
    );
  }, [vazifalar, q, holat]);
  const jami = mezonlar.reduce((s, m) => s + (Number(v[m.kod]) || 0), 0);

  async function vaznSaqlash(e: React.FormEvent) {
    e.preventDefault();
    setBand(true);
    try {
      await api.put(`/api/ekspertlar/${ekspert.id}/vazn`, { vaznlar: Object.fromEntries(mezonlar.map((m) => [m.kod, Number(v[m.kod])])) });
      toast(t("au.saqlandi"));
    } catch (err) {
      toast(xatoMatni(err), "error");
    } finally {
      setBand(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="eyebrow">{ekspert.ism}</div>
        <h1 className="mt-1.5">{t("au.vazifalar")}</h1>
        <p className="hint mt-2 max-w-[80ch]">{t("au.vazifalarIzoh")}</p>
      </motion.header>

      <Card koarish={false} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-bold">{t("au.bajarildi", { a: bajarilgan, b: vazifalar.length })}</p>
          <div className="h-2.5 min-w-[160px] flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: "var(--ok)" }}
              initial={{ width: 0 }}
              animate={{ width: `${vazifalar.length ? (bajarilgan / vazifalar.length) * 100 : 0}%` }}
            />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <label className="field">
            <span>{t("ms.qidiruv")}</span>
            <input type="search" value={q} placeholder={t("au.qidiruv")} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label className="field">
            <span>{t("au.holat")}</span>
            <select value={holat} onChange={(e) => setHolat(e.target.value as Holat)}>
              <option value="">{t("u.barchasi")}</option>
              <option value="yoq">{t("au.qilinmagan")}</option>
              <option value="bor">{t("au.qilingan")}</option>
            </select>
          </label>
        </div>
        <div className="table-wrap mt-3">
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>{t("u.sarlavha")}</th>
                <th>{t("u.nashr")}</th>
                <th>{t("u.sana")}</th>
                <th>{t("au.holat")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {royxat.map((x) => (
                <tr key={x.id}>
                  <td className="id">{idRaqami(x.id)}</td>
                  <td className="font-semibold">{x.sarlavha}</td>
                  <td className="whitespace-nowrap">
                    {x.nashr} <span className="hint">· {media(x.turi)}</span>
                  </td>
                  <td className="whitespace-nowrap">{sana(x.sana)}</td>
                  <td>
                    {x.bor ? (
                      <span className="tag" style={{ borderColor: "var(--ok)", color: "var(--ok)" }}>
                        ✓ {t("au.qilingan")}
                        {x.lpsi != null && ` · ${son(x.lpsi)}`}
                      </span>
                    ) : (
                      <span className="tag">{t("au.qilinmagan")}</span>
                    )}
                  </td>
                  <td className="text-right">
                    <Link className={`btn btn-sm ${x.bor ? "" : "btn-primary"}`} href={`/tahlil/${x.id}`}>
                      {x.bor ? t("au.davomEttirish") : t("au.tahlilQilish")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card koarish={false}>
        <CardHead title={t("au.vaznSorov")} izoh={t("au.vaznSorovIzoh")} />
        <form onSubmit={vaznSaqlash}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {mezonlar.map((m) => (
              <label key={m.kod} className="field" title={atama.mezonTavsif(m.kod, m.tavsif)}>
                <span>
                  {m.kod}. {atama.mezon(m.kod, m.nomi)}
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  required
                  value={v[m.kod]}
                  onChange={(e) => setV({ ...v, [m.kod]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="font-bold tabular-nums" style={{ color: Math.abs(jami - 100) < 0.01 ? "var(--ok)" : "var(--danger)" }}>
              {t("au.jami", { v: son(jami) })}
            </span>
            <button className="btn btn-primary" type="submit" disabled={band || Math.abs(jami - 100) > 0.01}>
              {t("au.yuborish")}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
