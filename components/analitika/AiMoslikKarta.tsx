"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

import { useTil } from "@/components/i18n/TilProvider";
import { Card, CardHead } from "@/components/ui/Card";
import type { AiMoslik, MoslikQatori } from "@/lib/ai/taklif";
import type { KappaTalqini } from "@/lib/statistika";

const RANG: Record<KappaTalqini, string> = {
  yomon: "var(--lvl-0)",
  sezilarsiz: "var(--lvl-0)",
  kuchsiz: "var(--lvl-1)",
  ortacha: "var(--lvl-1)",
  sezilarli: "var(--lvl-2)",
  deyarliTola: "var(--lvl-3)",
};

/** ТЗ v2, 4.3: AI takliflari va tadqiqotchi yakuniy qarorlari mosligi — foiz va Cohen κ kategoriyalar kesimida */
export function AiMoslikKarta({ m, kategoriyaNomlari }: { m: AiMoslik; kategoriyaNomlari: Record<string, string> }) {
  const { t, son, atama } = useTil();
  if (!m.takliflar) return null;
  const nomi = (q: MoslikQatori) =>
    q.tur === "maydon"
      ? t(`iz.${q.kalit}` as "iz.sar_lid")
      : q.tur === "sarlavhaTuri"
        ? atama.lugat("sarlavha_turi", q.kalit)
        : q.tur === "kategoriya"
          ? atama.kategoriya(q.kalit, kategoriyaNomlari[q.kalit])
          : t("ai.m.belgilarJami");
  const guruhlar: [string, MoslikQatori[]][] = [
    [t("ai.m.maydonlar"), m.qatorlar.filter((q) => q.tur === "maydon")],
    [t("ai.m.sarlavhaTurlari"), m.qatorlar.filter((q) => q.tur === "sarlavhaTuri")],
    [t("ai.m.kategoriyalar"), m.qatorlar.filter((q) => q.tur === "kategoriya" || q.tur === "jami")],
  ];
  return (
    <Card koarish={false}>
      <CardHead
        title={t("ai.moslik")}
        izoh={t("ai.moslikIzoh")}
        chap={
          <span className="grid h-9 w-9 flex-none place-items-center rounded-xl" style={{ background: "var(--ai-grad)", color: "#3b2a00" }}>
            <Sparkles size={18} />
          </span>
        }
      />
      <p className="mb-3 text-[13px] font-semibold" style={{ color: "var(--ink-2)" }}>
        {t("ai.m.jami", { t: m.takliflar, m: m.materiallar, a: m.tasdiqlangan, o: m.ozgartirilgan, r: m.rad, k: m.kutilmoqda })}
      </p>
      {!m.qatorlar.length ? (
        <p className="hint py-6 text-center">{t("ai.m.yoq")}</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{t("ai.m.korsatkich")}</th>
                <th className="num">{t("ai.m.n")}</th>
                <th className="num">{t("ai.m.mos")}</th>
                <th>{t("ai.m.kappa")}</th>
                <th>{t("ai.m.talqin")}</th>
              </tr>
            </thead>
            <tbody>
              {guruhlar
                .filter(([, q]) => q.length)
                .flatMap(([g, qatorlar]) => [
                  <tr key={`g-${g}`}>
                    <td colSpan={5} className="!pt-4 text-[11.5px] font-extrabold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                      {g}
                    </td>
                  </tr>,
                  ...qatorlar.map((q, i) => (
                    <tr key={`${q.tur}-${q.kalit}`}>
                      <td className={q.tur === "jami" ? "font-extrabold" : "font-semibold"}>{nomi(q)}</td>
                      <td className="num">{q.n}</td>
                      <td className="num">{q.mos == null ? "—" : son(q.mos)}</td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="relative h-2.5 w-28 flex-none overflow-hidden rounded-full" style={{ background: "var(--surface-2)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
                            <motion.div
                              className="absolute inset-y-0 left-0 rounded-full"
                              style={{ background: q.talqin ? RANG[q.talqin] : "var(--line-strong)" }}
                              initial={{ width: 0 }}
                              whileInView={{ width: `${Math.max(0, Math.min(1, q.kappa ?? 0)) * 100}%` }}
                              viewport={{ once: true }}
                              transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.04 * i }}
                            />
                          </div>
                          <span className="font-bold tabular-nums">{q.kappa == null ? "—" : son(q.kappa, 3)}</span>
                        </div>
                      </td>
                      <td>{q.talqin ? <span className="tag">{t(`ai.k.${q.talqin}`)}</span> : "—"}</td>
                    </tr>
                  )),
                ])}
            </tbody>
          </table>
        </div>
      )}
      <p className="hint mt-3">{t("ai.m.modellar", { v: m.modellar.join(", ") || "—", p: m.promptlar.join(", ") || "—" })}</p>
    </Card>
  );
}
