"use client";

import { useMemo, useState } from "react";

import { useTil } from "@/components/i18n/TilProvider";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { sana } from "@/lib/format";
import { wordRoyxati, type Ajratish, type Misol, type Raqamlash, type WordMatnlari, type WordSozlama } from "@/lib/misollar";

const BOSH: WordSozlama = {
  gap: true,
  ajratish: "qalin",
  raqamlash: "qavs",
  boshlangich: 1,
  guruhlash: false,
  sarlavhaBilan: false,
  izohBilan: false,
  olchamPt: 14,
};
const SAQLASH_KALITI = "mp_misol_word";
const KORINISH_SONI = 25;
const KOP = 30;

/** Sozlamalar shu brauzerda eslab qolinadi (qulaylik uchun; bo‘lmasa standart qiymatlar). */
function oqish(): WordSozlama {
  try {
    const s = localStorage.getItem(SAQLASH_KALITI);
    if (s) return { ...BOSH, ...JSON.parse(s), boshlangich: BOSH.boshlangich };
  } catch {}
  return BOSH;
}
function yozish(s: WordSozlama) {
  try {
    localStorage.setItem(SAQLASH_KALITI, JSON.stringify(s));
  } catch {}
}

/** Buferga HTML (Word formatlashni saqlaydi) va oddiy matn; eski brauzerlarda — tanlab nusxalash. */
async function buferga(html: string, matn: string) {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([matn], { type: "text/plain" }),
        }),
      ]);
      return;
    } catch {
      // pastdagi usulga o‘tiladi
    }
  }
  const div = document.createElement("div");
  div.contentEditable = "true";
  div.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
  div.innerHTML = html;
  document.body.appendChild(div);
  const range = document.createRange();
  range.selectNodeContents(div);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  const ok = document.execCommand("copy");
  sel?.removeAllRanges();
  div.remove();
  if (!ok) throw new Error("copy");
}

export function WordOynasi({ ochiq, yopish, misollar }: { ochiq: boolean; yopish: () => void; misollar: Misol[] }) {
  const { t, til, atama } = useTil();
  const toast = useToast();
  const [s, setSHolat] = useState<WordSozlama>(oqish);
  const set = (q: Partial<WordSozlama>) =>
    setSHolat((o) => {
      const yangi = { ...o, ...q };
      yozish(yangi);
      return yangi;
    });

  const mt: WordMatnlari = useMemo(
    () => ({
      kategoriya: (m) => atama.kategoriya(m.kategoriya, m.kategoriya_nomi),
      sana: (iso) =>
        til === "en"
          ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
          : sana(iso),
      qoshtirnoq: til === "en" ? ["“", "”"] : ["«", "»"],
      ichki: til === "en" ? ["‘", "’"] : ["„", "“"],
    }),
    [til, atama],
  );

  const korinish = useMemo(() => (ochiq ? wordRoyxati(misollar, s, mt, KORINISH_SONI) : null), [ochiq, misollar, s, mt]);

  async function nusxa() {
    try {
      const { html, matn } = wordRoyxati(misollar, s, mt);
      await buferga(html, matn);
      toast(t("ms.w.nusxalandi", { n: misollar.length }));
    } catch {
      toast(t("ms.w.xato"), "error");
    }
  }

  const maydon = "field min-w-0";
  return (
    <Dialog
      open={ochiq}
      onClose={yopish}
      title={t("ms.w.dialog")}
      keng
      footer={
        <button className="btn btn-primary" onClick={nusxa} disabled={!misollar.length}>
          {t("ms.w.nusxa", { n: misollar.length })}
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <label className={`${maydon} col-span-2 sm:col-span-1 lg:col-span-2`}>
          <span>{t("ms.w.mazmun")}</span>
          <select value={s.gap ? "gap" : "fragment"} onChange={(e) => set({ gap: e.target.value === "gap" })}>
            <option value="gap">{t("ms.w.gap")}</option>
            <option value="fragment">{t("ms.w.fragment")}</option>
          </select>
        </label>
        <label className={maydon}>
          <span>{t("ms.w.ajratish")}</span>
          <select value={s.ajratish} disabled={!s.gap} onChange={(e) => set({ ajratish: e.target.value as Ajratish })}>
            <option value="qalin">{t("ms.w.qalin")}</option>
            <option value="kursiv">{t("ms.w.kursiv")}</option>
            <option value="tagiChiziq">{t("ms.w.tagiChiziq")}</option>
          </select>
        </label>
        <label className={maydon}>
          <span>{t("ms.w.raqamlash")}</span>
          <select value={s.raqamlash} onChange={(e) => set({ raqamlash: e.target.value as Raqamlash })}>
            <option value="qavs">{t("ms.w.qavs")}</option>
            <option value="nuqta">{t("ms.w.nuqta")}</option>
            <option value="yoq">{t("ms.w.yoq")}</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={maydon}>
            <span>{t("ms.w.boshlangich")}</span>
            <input
              type="number"
              min={1}
              max={9999}
              value={s.boshlangich}
              disabled={s.raqamlash === "yoq"}
              onChange={(e) => set({ boshlangich: Math.max(1, Math.min(9999, Math.floor(Number(e.target.value) || 1))) })}
            />
          </label>
          <label className={maydon}>
            <span>{t("ms.w.olcham")}</span>
            <select value={s.olchamPt} onChange={(e) => set({ olchamPt: Number(e.target.value) })}>
              {[12, 13, 14].map((v) => (
                <option key={v} value={v}>
                  {t("rs.pt", { v })}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {(
          [
            ["guruhlash", "ms.w.guruhlash"],
            ["sarlavhaBilan", "ms.w.sarlavha"],
            ["izohBilan", "ms.w.izoh"],
          ] as const
        ).map(([k, kalit]) => (
          <label key={k} className="inline-flex items-center gap-2 text-[13px] font-semibold">
            <input type="checkbox" checked={s[k]} onChange={(e) => set({ [k]: e.target.checked })} />
            {t(kalit)}
          </label>
        ))}
      </div>

      {misollar.length > KOP && (
        <p className="mt-3 text-[13px] font-semibold" style={{ color: "var(--lvl-1)" }}>
          {t("ms.w.koproq", { n: misollar.length })}
        </p>
      )}

      <div className="eyebrow mt-4">{t("ms.w.korinish")}</div>
      {/* Ko‘rinish har doim oq fonda — Word sahifasidagidek */}
      <div
        className="mt-2 rounded-xl border px-6 py-5"
        style={{ background: "#FFFFFF", color: "#000000", borderColor: "var(--line-strong)" }}
        dangerouslySetInnerHTML={{ __html: korinish?.tana ?? "" }}
      />
      {misollar.length > KORINISH_SONI && (
        <p className="hint mt-1 text-center">…{t("ms.korsatilmoqda", { a: KORINISH_SONI, b: misollar.length })}</p>
      )}
      <p className="hint mt-3">{t("ms.w.formatIzoh")}</p>
    </Dialog>
  );
}
