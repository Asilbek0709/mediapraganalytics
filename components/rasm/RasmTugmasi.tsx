"use client";

import { useMemo, useState } from "react";

import { useTil } from "@/components/i18n/TilProvider";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { faylNomi, pngDpi, rasmSvg, taxminiyKenglik, type Olchagich, type RasmMalumot, type Shrift } from "@/lib/rasm";

interface Tanlov {
  kengSm: number;
  shrift: Shrift;
  olchamPt: number;
  rangli: boolean;
  sarlavhaBor: boolean;
  dpi: number;
}

const BOSH: Tanlov = { kengSm: 16, shrift: "Times New Roman", olchamPt: 11, rangli: true, sarlavhaBor: false, dpi: 300 };
const SAQLASH_KALITI = "mp_rasm";
const KENGLIKLAR = [8, 12, 16, 17];
const OLCHAMLAR = [9, 10, 11, 12, 14];
const DPILAR = [150, 300, 600];

/** Tanlangan sozlamalar shu brauzerda eslab qolinadi (qulaylik uchun; bo‘lmasa standart qiymatlar). */
function oqish(): Tanlov {
  try {
    const s = localStorage.getItem(SAQLASH_KALITI);
    if (s) return { ...BOSH, ...JSON.parse(s) };
  } catch {}
  return BOSH;
}
function yozish(t: Tanlov) {
  try {
    localStorage.setItem(SAQLASH_KALITI, JSON.stringify(t));
  } catch {}
}

let kontekst: CanvasRenderingContext2D | null | undefined;
/** Brauzerdagi haqiqiy shrift bo‘yicha matn kengligi — yorliqlar aniq joylashadi. */
function olchagich(shrift: Shrift): Olchagich {
  if (kontekst === undefined) kontekst = document.createElement("canvas").getContext("2d");
  const oila = shrift === "Arial" ? "Arial, Helvetica, sans-serif" : "'Times New Roman', Times, serif";
  return (matn, px, qalin) => {
    if (!kontekst) return taxminiyKenglik(matn, px, qalin, shrift);
    kontekst.font = `${qalin ? "bold " : ""}${px}px ${oila}`;
    return kontekst.measureText(matn).width;
  };
}

const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

function yuklabBerish(blob: Blob, nom: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** SVG’ni tanlangan dpi’da rasterlaydi va PNG’ga jismoniy o‘lchamni yozadi. */
async function pngYasash(svg: string, kenglik: number, balandlik: number, dpi: number): Promise<Blob> {
  const img = new Image();
  img.src = svgUrl(svg);
  await img.decode();
  const k = dpi / 96;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(kenglik * k);
  canvas.height = Math.round(balandlik * k);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((ok, xato) => canvas.toBlob((b) => (b ? ok(b) : xato(new Error("png"))), "image/png"));
  return new Blob([pngDpi(new Uint8Array(await blob.arrayBuffer()), dpi)], { type: "image/png" });
}

function RasmBelgisi() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M7.5 15.5v-3M12 15.5V9M16.5 15.5v-5" />
    </svg>
  );
}

/**
 * Grafik kartasidagi «Rasm» tugmasi: dissertatsiya uchun PNG/SVG eksport oynasini ochadi.
 * malumot — ochilgan paytdagi grafik ma’lumoti (shu paytda hisoblanadi).
 */
export function RasmTugmasi({ malumot }: { malumot: () => RasmMalumot }) {
  const { t } = useTil();
  const [ochiq, setOchiq] = useState(false);
  const [joriy, setJoriy] = useState<RasmMalumot | null>(null);

  return (
    <>
      <button
        type="button"
        className="btn btn-sm inline-flex items-center gap-1.5"
        title={t("rs.tugmaTitle")}
        onClick={() => {
          setJoriy(malumot());
          setOchiq(true);
        }}
      >
        <RasmBelgisi />
        {t("rs.tugma")}
      </button>
      {joriy && <RasmOynasi key={joriy.sarlavha} malumot={joriy} ochiq={ochiq} yopish={() => setOchiq(false)} />}
    </>
  );
}

function RasmOynasi({ malumot, ochiq, yopish }: { malumot: RasmMalumot; ochiq: boolean; yopish: () => void }) {
  const { t, son } = useTil();
  const toast = useToast();
  const [tanlov, setTanlovHolat] = useState<Tanlov>(oqish);
  const [sarlavha, setSarlavha] = useState(malumot.sarlavha);
  const [band, setBand] = useState(false);

  const setTanlov = (q: Partial<Tanlov>) =>
    setTanlovHolat((o) => {
      const yangi = { ...o, ...q };
      yozish(yangi);
      return yangi;
    });

  const natija = useMemo(
    () =>
      rasmSvg(malumot.rasm, {
        kengSm: tanlov.kengSm,
        shrift: tanlov.shrift,
        olchamPt: tanlov.olchamPt,
        rangli: tanlov.rangli,
        sarlavha: tanlov.sarlavhaBor ? sarlavha.trim() || null : null,
        son,
        olchash: olchagich(tanlov.shrift),
      }),
    [malumot.rasm, tanlov, sarlavha, son],
  );
  const nom = faylNomi(sarlavha || malumot.sarlavha);
  const k = tanlov.dpi / 96;

  async function bajarish(fn: () => Promise<void>) {
    setBand(true);
    try {
      await fn();
    } catch {
      toast(t("rs.xato"), "error");
    } finally {
      setBand(false);
    }
  }

  const pngYukla = () =>
    bajarish(async () => yuklabBerish(await pngYasash(natija.svg, natija.kenglik, natija.balandlik, tanlov.dpi), `${nom}.png`));

  const svgYukla = () =>
    bajarish(async () =>
      yuklabBerish(new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${natija.svg}`], { type: "image/svg+xml" }), `${nom}.svg`),
    );

  async function nusxa() {
    setBand(true);
    try {
      // Promise’ni to‘g‘ridan-to‘g‘ri berish: foydalanuvchi bosgan lahzadagi ruxsat saqlanadi
      const png = pngYasash(natija.svg, natija.kenglik, natija.balandlik, tanlov.dpi);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      toast(t("rs.nusxalandi"));
    } catch {
      toast(t("rs.nusxaXato"), "error");
    } finally {
      setBand(false);
    }
  }

  const maydon = "field min-w-0";
  return (
    <Dialog
      open={ochiq}
      onClose={yopish}
      title={t("rs.dialog")}
      keng
      footer={
        <>
          <button className="btn" onClick={nusxa} disabled={band}>
            {t("rs.nusxa")}
          </button>
          <button className="btn" onClick={svgYukla} disabled={band}>
            {t("rs.svg")}
          </button>
          <button className="btn btn-primary" onClick={pngYukla} disabled={band}>
            {t("rs.png")} · {tanlov.dpi} dpi
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <label className={maydon}>
          <span>{t("rs.kenglik")}</span>
          <select value={tanlov.kengSm} onChange={(e) => setTanlov({ kengSm: Number(e.target.value) })}>
            {KENGLIKLAR.map((v) => (
              <option key={v} value={v}>
                {t("rs.sm", { v })}
              </option>
            ))}
          </select>
        </label>
        <label className={maydon}>
          <span>{t("rs.shrift")}</span>
          <select value={tanlov.shrift} onChange={(e) => setTanlov({ shrift: e.target.value as Shrift })}>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Arial">Arial</option>
          </select>
        </label>
        <label className={maydon}>
          <span>{t("rs.olcham")}</span>
          <select value={tanlov.olchamPt} onChange={(e) => setTanlov({ olchamPt: Number(e.target.value) })}>
            {OLCHAMLAR.map((v) => (
              <option key={v} value={v}>
                {t("rs.pt", { v })}
              </option>
            ))}
          </select>
        </label>
        <label className={maydon}>
          <span>{t("rs.rang")}</span>
          <select value={tanlov.rangli ? "ha" : "yoq"} onChange={(e) => setTanlov({ rangli: e.target.value === "ha" })}>
            <option value="ha">{t("rs.rangli")}</option>
            <option value="yoq">{t("rs.oqQora")}</option>
          </select>
        </label>
        <label className={maydon}>
          <span>{t("rs.sifat")}</span>
          <select value={tanlov.dpi} onChange={(e) => setTanlov({ dpi: Number(e.target.value) })}>
            {DPILAR.map((v) => (
              <option key={v} value={v}>
                {v} dpi
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <label className="inline-flex items-center gap-2 text-[13px] font-semibold">
          <input type="checkbox" checked={tanlov.sarlavhaBor} onChange={(e) => setTanlov({ sarlavhaBor: e.target.checked })} />
          {t("rs.sarlavhaQoshish")}
        </label>
        {tanlov.sarlavhaBor ? (
          <label className="field">
            <span>{t("rs.sarlavhaMatni")}</span>
            <input type="text" maxLength={200} value={sarlavha} onChange={(e) => setSarlavha(e.target.value)} />
          </label>
        ) : (
          <p className="hint">{t("rs.sarlavhaIzoh")}</p>
        )}
      </div>

      {/* Ko‘rinish har doim oq fonda — qorong‘i mavzuda ham bosmadagidek */}
      <div className="mt-4 overflow-hidden rounded-xl border p-3" style={{ background: "#FFFFFF", borderColor: "var(--line-strong)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={svgUrl(natija.svg)} alt={sarlavha} className="mx-auto block h-auto" style={{ width: "100%", maxWidth: natija.kenglik * 1.4 }} />
      </div>
      <p className="hint mt-3">
        {t("rs.olchamIzoh", {
          w: son(natija.kengSm, 1),
          h: son(natija.balandSm, 1),
          px: `${Math.round(natija.kenglik * k)} × ${Math.round(natija.balandlik * k)}`,
        })}{" "}
        {t("rs.formatIzoh")}
      </p>
    </Dialog>
  );
}
