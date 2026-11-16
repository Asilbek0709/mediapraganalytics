"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, FileUp, Link2, LoaderCircle, ScanText } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useTil } from "@/components/i18n/TilProvider";
import { Dialog } from "@/components/ui/Dialog";
import { api, xatoMatni } from "@/lib/client";
import type { Kalit } from "@/lib/i18n";
import type { ManbaTuri } from "@/lib/manba";
import type { FaylNatijasi, Jarayon, OcrTil } from "@/lib/faylMatni";

/** Havola yoki fayldan olingan, hali saqlanmagan material — formaga o‘tadi */
export interface ManbaQoralama {
  turi: ManbaTuri;
  maydonlar: {
    nashr_id?: number | null;
    sana?: string | null;
    mavzu?: string | null;
    havola?: string | null;
    sarlavha: string;
    lid: string;
    matn: string;
  };
  olingan_sana?: string;
  arxiv?: string;
  qoida?: string;
  ogohlantirishlar?: string[];
  takror?: { id: number; sarlavha: string; sabab: "havola" | "matn" } | null;
  ocrSahifalar?: number;
}

interface HavolaJavobi {
  sarlavha: string;
  lid: string;
  matn: string;
  sana: string | null;
  rukn: string | null;
  havola: string;
  qoida: string;
  ogohlantirishlar: string[];
  nashr_id: number | null;
  olingan_sana: string;
  arxiv: string;
  takror: ManbaQoralama["takror"];
}

function Qadamlar({ qadamlar, joriy }: { qadamlar: string[]; joriy: number }) {
  return (
    <ul className="mt-5 flex flex-col gap-2.5">
      {qadamlar.map((q, i) => {
        const holat = i + 1 < joriy ? "tayyor" : i + 1 === joriy ? "jarayon" : "kutish";
        return (
          <motion.li
            key={q}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: holat === "kutish" ? 0.45 : 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex items-center gap-2.5 text-[13.5px] font-semibold"
          >
            <span
              className="grid h-6 w-6 flex-none place-items-center rounded-full"
              style={{
                background: holat === "tayyor" ? "var(--brand-grad)" : "var(--surface-2)",
                color: holat === "tayyor" ? "#fff" : "var(--brand)",
                boxShadow: holat === "tayyor" ? "var(--glow)" : "inset 0 0 0 1px var(--line)",
              }}
            >
              {holat === "tayyor" ? <Check size={14} strokeWidth={3} /> : holat === "jarayon" ? <LoaderCircle size={14} className="animate-spin" /> : null}
            </span>
            {q}
          </motion.li>
        );
      })}
    </ul>
  );
}

// ------------------------------------------------------------------ havola orqali

export function HavolaOynasi({ open, onClose, onTayyor }: { open: boolean; onClose: () => void; onTayyor: (q: ManbaQoralama) => void }) {
  const { t } = useTil();
  const [url, setUrl] = useState("");
  const [qadam, setQadam] = useState(0);
  const [xato, setXato] = useState("");
  const band = qadam > 0;

  useEffect(() => {
    if (!open) setXato("");
  }, [open]);

  async function ajrat(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setXato("");
    setQadam(1);
    const t1 = setTimeout(() => setQadam(2), 1400);
    const t2 = setTimeout(() => setQadam(3), 3000);
    try {
      const d = await api.post<HavolaJavobi>("/api/materiallar/havola", { url: url.trim() });
      setQadam(4);
      onTayyor({
        turi: "havola",
        maydonlar: { nashr_id: d.nashr_id, sana: d.sana, mavzu: d.rukn, havola: d.havola, sarlavha: d.sarlavha, lid: d.lid, matn: d.matn },
        olingan_sana: d.olingan_sana,
        arxiv: d.arxiv,
        qoida: d.qoida,
        ogohlantirishlar: d.ogohlantirishlar,
        takror: d.takror,
      });
      setUrl("");
    } catch (er) {
      setXato(xatoMatni(er));
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setQadam(0);
    }
  }

  return (
    <Dialog open={open} onClose={() => !band && onClose()} title={t("mb.h.sarlavha")}>
      <p className="hint">{t("mb.h.izoh")}</p>
      <form onSubmit={ajrat} className="mt-4 flex flex-col gap-2.5 sm:flex-row">
        <label className="field kirish-maydon flex-1">
          <span className="sr-only">URL</span>
          <Link2 size={16} className="kirish-belgi" style={{ top: 12 }} aria-hidden />
          <input
            type="url"
            required
            autoFocus
            placeholder="https://kun.uz/news/…"
            value={url}
            disabled={band}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={band || !url.trim()}>
          {band ? <LoaderCircle size={16} className="animate-spin" /> : null}
          {t("mb.h.ajrat")}
        </button>
      </form>
      <AnimatePresence>
        {band && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <Qadamlar qadamlar={[t("mb.h.qadam1"), t("mb.h.qadam2"), t("mb.h.qadam3")]} joriy={qadam} />
          </motion.div>
        )}
      </AnimatePresence>
      {xato && (
        <p role="alert" className="mt-4 text-[13.5px] font-semibold" style={{ color: "var(--danger)" }}>
          {xato}
        </p>
      )}
      <p className="hint mt-5">{t("mb.h.qoidalar")}</p>
    </Dialog>
  );
}

// ------------------------------------------------------------------ fayldan (PDF, rasm)

const TILLAR: [OcrTil, Kalit][] = [
  ["uzb+uzb_cyrl", "mb.f.t.aralash"],
  ["uzb", "mb.f.t.uzb"],
  ["uzb_cyrl", "mb.f.t.uzbCyrl"],
  ["rus", "mb.f.t.rus"],
];

export function FaylOynasi({ open, onClose, onTayyor }: { open: boolean; onClose: () => void; onTayyor: (q: ManbaQoralama) => void }) {
  const { t } = useTil();
  const [til, setTil] = useState<OcrTil>("uzb+uzb_cyrl");
  const [jarayon, setJarayon] = useState<Jarayon | null>(null);
  const [natija, setNatija] = useState<FaylNatijasi | null>(null);
  const [matn, setMatn] = useState("");
  const [xato, setXato] = useState("");
  const [ustida, setUstida] = useState(false);
  const toxtatish = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // oyna yopilsa — ish to‘xtatiladi va holat tozalanadi
  useEffect(() => {
    if (open) return;
    toxtatish.current?.abort();
    setJarayon(null);
    setNatija(null);
    setMatn("");
    setXato("");
  }, [open]);

  async function oqish(fayl: File) {
    const { MAKS_FAYL, faylMatni, pdfmi, rasmmi } = await import("@/lib/faylMatni");
    setXato("");
    if (!pdfmi(fayl) && !rasmmi(fayl)) return setXato(t("mb.f.turXato"));
    if (fayl.size > MAKS_FAYL) return setXato(t("mb.f.katta"));
    const c = new AbortController();
    toxtatish.current = c;
    setJarayon({ bosqich: "oqish" });
    try {
      const n = await faylMatni(fayl, til, (j) => !c.signal.aborted && setJarayon(j), c.signal);
      if (c.signal.aborted) return;
      if (!n.matn.trim()) setXato(t("mb.f.bosh"));
      else {
        setNatija(n);
        setMatn(n.matn);
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setXato(t("mb.f.xato", { v: xatoMatni(e) }));
    } finally {
      if (!c.signal.aborted) setJarayon(null);
    }
  }

  async function formaga() {
    const { formagaBolish } = await import("@/lib/faylMatni");
    const f = formagaBolish(matn);
    onTayyor({
      turi: natija && natija.ocrSahifalar > 0 ? "ocr" : "pdf",
      maydonlar: { ...f },
      ocrSahifalar: natija?.ocrSahifalar ?? 0,
    });
  }

  const ishlayapti = jarayon != null;
  const jarayonMatni = !jarayon
    ? ""
    : jarayon.bosqich === "model"
      ? t("mb.f.model")
      : jarayon.bosqich === "ocr"
        ? t("mb.f.ocr", { p: jarayon.foiz ?? 0 })
        : t("mb.f.oqilmoqda");
  const foiz = jarayon?.bosqich === "oqish" ? null : (jarayon?.foiz ?? 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("mb.f.sarlavha")}
      keng
      footer={
        natija ? (
          <>
            <button
              className="btn"
              onClick={() => {
                setNatija(null);
                setMatn("");
              }}
            >
              {t("mb.f.boshqa")}
            </button>
            <button className="btn btn-primary" onClick={formaga} disabled={!matn.trim()}>
              {t("mb.f.formaga")}
            </button>
          </>
        ) : undefined
      }
    >
      {!natija && (
        <>
          <p className="hint">{t("mb.f.izoh")}</p>
          <label className="field mt-4 max-w-[320px]">
            <span>{t("mb.f.til")}</span>
            <select value={til} onChange={(e) => setTil(e.target.value as OcrTil)} disabled={ishlayapti}>
              {TILLAR.map(([k, kalit]) => (
                <option key={k} value={k}>
                  {t(kalit)}
                </option>
              ))}
            </select>
          </label>
          <motion.button
            type="button"
            className="tashlash-joyi mt-4"
            data-ustida={ustida}
            disabled={ishlayapti}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setUstida(true);
            }}
            onDragLeave={() => setUstida(false)}
            onDrop={(e) => {
              e.preventDefault();
              setUstida(false);
              const f = e.dataTransfer.files?.[0];
              if (f) oqish(f);
            }}
            whileHover={ishlayapti ? undefined : { scale: 1.01 }}
          >
            {ishlayapti ? (
              <div className="flex w-full max-w-[420px] flex-col items-center gap-3">
                <ScanText size={30} className="animate-pulse" style={{ color: "var(--brand)" }} />
                <div className="text-[14px] font-bold" style={{ color: "var(--ink)" }}>
                  {jarayonMatni}
                </div>
                {jarayon?.jami ? <div className="hint">{t("mb.f.sahifa", { i: jarayon.sahifa ?? 1, n: jarayon.jami })}</div> : null}
                <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "var(--brand-grad)" }}
                    animate={{ width: foiz == null ? ["10%", "60%", "10%"] : `${foiz}%` }}
                    transition={foiz == null ? { duration: 1.6, repeat: Infinity } : { type: "spring", stiffness: 120, damping: 20 }}
                  />
                </div>
              </div>
            ) : (
              <>
                <FileUp size={30} style={{ color: "var(--brand)" }} />
                <div className="text-[14px] font-bold" style={{ color: "var(--ink)" }}>
                  {t("mb.f.tanlash")}
                </div>
                <div className="hint">{t("mb.f.turlar")}</div>
              </>
            )}
          </motion.button>
          <input
            ref={input}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) oqish(f);
            }}
          />
        </>
      )}

      {natija && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p
            className="rounded-xl px-3.5 py-2.5 text-[13px] font-semibold"
            style={{
              background: natija.ocrSahifalar ? "color-mix(in oklab, var(--lvl-1) 14%, transparent)" : "var(--accent-soft)",
              color: "var(--ink)",
            }}
          >
            {natija.ocrSahifalar ? t("mb.f.ocrIshlatildi", { n: natija.ocrSahifalar }) : t("mb.f.matnQatlam")}
          </p>
          <label className="field mt-4">
            <span>{t("mb.f.natija")}</span>
            <textarea rows={16} value={matn} onChange={(e) => setMatn(e.target.value)} />
            <span className="hint !font-normal">{t("mb.f.natijaIzoh")}</span>
          </label>
        </motion.div>
      )}

      {xato && (
        <p role="alert" className="mt-4 text-[13.5px] font-semibold" style={{ color: "var(--danger)" }}>
          {xato}
        </p>
      )}
    </Dialog>
  );
}
