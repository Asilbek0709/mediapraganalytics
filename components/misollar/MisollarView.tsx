"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useTil } from "@/components/i18n/TilProvider";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { api, xatoMatni } from "@/lib/client";
import { JANR_YOQ, sana as sanaFormat } from "@/lib/format";
import {
  faolFiltrmi,
  misolFiltriQatori,
  misollarniFiltrlash,
  type Misol,
  type MisolFiltr,
  type MisolTartibi,
} from "@/lib/misollar";
import type { Korpus } from "@/lib/misollarBaza";
import { WordOynasi } from "./WordOynasi";

const SAHIFA = 60;
const TARTIBLAR: MisolTartibi[] = ["kategoriya", "sana", "nashr", "tasdiq"];

export function MisollarView({ korpus, boshFiltr }: { korpus: Korpus; boshFiltr: MisolFiltr }) {
  const { t, son, atama, media } = useTil();
  const toast = useToast();
  const pathname = usePathname();
  const [filtr, setFiltr] = useState<MisolFiltr>(boshFiltr);
  const [misollar, setMisollar] = useState<Misol[]>(korpus.misollar);
  const [soni, setSoni] = useState(SAHIFA);
  const [wordOchiq, setWordOchiq] = useState(false);
  const q = useDeferredValue(filtr.q);

  // Filtr URL’da saqlanadi (sahifa qayta yuklanmaydi): havolani ulashish va «orqaga» uchun
  const qator = misolFiltriQatori(filtr);
  useEffect(() => {
    window.history.replaceState(null, "", qator ? `${pathname}?${qator}` : pathname);
  }, [qator, pathname]);

  const amaldagi = useMemo(() => ({ ...filtr, q }), [filtr, q]);
  const royxat = useMemo(() => misollarniFiltrlash(misollar, amaldagi), [misollar, amaldagi]);
  const katSanoq = useMemo(() => {
    const s = new Map<string, number>();
    for (const m of misollarniFiltrlash(misollar, amaldagi, "kategoriya")) s.set(m.kategoriya, (s.get(m.kategoriya) ?? 0) + 1);
    return s;
  }, [misollar, amaldagi]);

  const ozgartir = (yangi: Partial<MisolFiltr>) => {
    setFiltr((f) => ({ ...f, ...yangi }));
    setSoni(SAHIFA);
  };

  const katNomi = (kod: string, nomi?: string) => atama.kategoriya(kod, nomi);
  const muammolar = korpus.kategoriyalar.filter((k) => k.guruh === "muammo");
  const vositalar = korpus.kategoriyalar.filter((k) => k.guruh === "vosita");
  const katQiymati = filtr.kategoriya ?? (filtr.guruh ? `g:${filtr.guruh}` : "");

  const materiallarSoni = new Set(royxat.map((m) => m.material_id)).size;
  const tanlanganSoni = royxat.filter((m) => m.tanlangan).length;
  const ekspertKorgan = royxat.filter((m) => m.ekspertlar > 0);
  const tasdiqlangan = ekspertKorgan.filter((m) => m.tasdiq > 0).length;

  async function tanlash(m: Misol) {
    const yangi = !m.tanlangan;
    const almashtir = (v: boolean) => setMisollar((ms) => ms.map((x) => (x.id === m.id ? { ...x, tanlangan: v } : x)));
    almashtir(yangi);
    try {
      await api.put("/api/misollar/tanlangan", {
        material_id: m.material_id,
        kategoriya: m.kategoriya,
        qism: m.qism,
        fragment: m.fragment,
        tanlangan: yangi,
      });
    } catch (e) {
      almashtir(!yangi);
      toast(xatoMatni(e), "error");
    }
  }

  const bolinma = (
    <>
      <option value="">{t("ms.barchaKategoriyalar")}</option>
      <optgroup label={t("kel.g.muammo")}>
        <option value="g:muammo">{t("kel.g.muammo")} — {t("ms.hammasi").toLowerCase()}</option>
        {muammolar.map((k) => (
          <option key={k.kod} value={k.kod}>
            {katNomi(k.kod, k.nomi)}
          </option>
        ))}
      </optgroup>
      <optgroup label={t("kel.g.vosita")}>
        <option value="g:vosita">{t("kel.g.vosita")} — {t("ms.hammasi").toLowerCase()}</option>
        {vositalar.map((k) => (
          <option key={k.kod} value={k.kod}>
            {katNomi(k.kod, k.nomi)}
          </option>
        ))}
      </optgroup>
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="eyebrow">{t("ms.eyebrow")}</div>
        <h1 className="mt-1.5">{t("ms.sarlavha")}</h1>
        <p className="hint mt-2 max-w-[78ch]">{t("ms.izoh")}</p>
      </motion.header>

      {korpus.misollar.length === 0 ? (
        <Card koarish={false} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <p className="py-10 text-center font-semibold">{t("ms.boshUmumiy")}</p>
          {korpus.fragmentsiz > 0 && <p className="hint text-center">{t("ms.fragmentsiz", { n: korpus.fragmentsiz })}</p>}
        </Card>
      ) : (
        <>
          <Card koarish={false} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="field sm:col-span-2">
                <span>{t("ms.qidiruv")}</span>
                <input
                  type="search"
                  value={filtr.q ?? ""}
                  placeholder={t("ms.qidiruvPh")}
                  onChange={(e) => ozgartir({ q: e.target.value || undefined })}
                />
              </label>
              <label className="field">
                <span>{t("u.kategoriya")}</span>
                <select
                  value={katQiymati}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v.startsWith("g:")) ozgartir({ guruh: v.slice(2) as Misol["guruh"], kategoriya: undefined });
                    else ozgartir({ kategoriya: v || undefined, guruh: undefined });
                  }}
                >
                  {bolinma}
                </select>
              </label>
              <label className="field">
                <span>{t("u.qism")}</span>
                <select value={filtr.qism ?? ""} onChange={(e) => ozgartir({ qism: (e.target.value || undefined) as Misol["qism"] })}>
                  <option value="">{t("ms.barchaQismlar")}</option>
                  <option value="sarlavha">{t("u.sarlavha")}</option>
                  <option value="lid">{t("u.lid")}</option>
                  <option value="matn">{t("u.matn")}</option>
                </select>
              </label>
              <label className="field">
                <span>{t("u.mediaTuri")}</span>
                <select value={filtr.turi ?? ""} onChange={(e) => ozgartir({ turi: (e.target.value || undefined) as Misol["turi"] })}>
                  <option value="">{t("u.barchasi")}</option>
                  <option value="bosma">{t("u.bosma")}</option>
                  <option value="raqamli">{t("u.raqamli")}</option>
                </select>
              </label>
              <label className="field">
                <span>{t("u.nashr")}</span>
                <select
                  value={filtr.nashr_id ?? ""}
                  onChange={(e) => ozgartir({ nashr_id: e.target.value ? Number(e.target.value) : undefined })}
                >
                  <option value="">{t("u.barchaNashrlar")}</option>
                  {korpus.nashrlar.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.nomi}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t("u.janr")}</span>
                <select value={filtr.janr ?? ""} onChange={(e) => ozgartir({ janr: e.target.value || undefined })}>
                  <option value="">{t("u.barchaJanrlar")}</option>
                  {korpus.janrlar.map((j) => (
                    <option key={j} value={j}>
                      {j === JANR_YOQ ? t("u.janrYoq") : atama.janr(j)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="field">
                  <span>{t("u.sanaDan")}</span>
                  <input type="date" value={filtr.dan ?? ""} onChange={(e) => ozgartir({ dan: e.target.value || undefined })} />
                </label>
                <label className="field">
                  <span>{t("u.sanaGacha")}</span>
                  <input type="date" value={filtr.gacha ?? ""} onChange={(e) => ozgartir({ gacha: e.target.value || undefined })} />
                </label>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {(
                [
                  ["tanlangan", "ms.faqatTanlangan"],
                  ["tasdiq", "ms.faqatTasdiq"],
                  ["toliq", "ms.faqatToliq"],
                ] as const
              ).map(([k, kalit]) => (
                <label key={k} className="chip relative" data-on={!!filtr[k]}>
                  <input type="checkbox" checked={!!filtr[k]} onChange={(e) => ozgartir({ [k]: e.target.checked || undefined })} />
                  {t(kalit)}
                </label>
              ))}
              <span className="ml-auto" />
              <label className="field !flex-row items-center gap-2">
                <span className="whitespace-nowrap">{t("ms.tartib")}</span>
                <select value={filtr.tartib ?? "kategoriya"} onChange={(e) => ozgartir({ tartib: e.target.value as MisolTartibi })}>
                  {TARTIBLAR.map((v) => (
                    <option key={v} value={v}>
                      {t(`ms.t.${v}`)}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn" disabled={!faolFiltrmi(filtr)} onClick={() => ozgartir({ ...Object.fromEntries(Object.keys(filtr).map((k) => [k, undefined])), tartib: filtr.tartib })}>
                {t("u.tozalash")}
              </button>
            </div>
          </Card>

          {/* Kategoriyalar bo‘yicha sanoq — boshqa filtrlar ostida; bosilsa shu kategoriya tanlanadi */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("u.kategoriya")}>
            <button
              className="chip"
              data-on={!filtr.kategoriya}
              onClick={() => ozgartir({ kategoriya: undefined })}
            >
              {t("ms.hammasi")} <span className="tabular-nums opacity-80">{[...katSanoq.values()].reduce((a, b) => a + b, 0)}</span>
            </button>
            {korpus.kategoriyalar
              .filter((k) => (katSanoq.get(k.kod) ?? 0) > 0 || filtr.kategoriya === k.kod)
              .map((k) => (
                <button
                  key={k.kod}
                  className="chip"
                  data-on={filtr.kategoriya === k.kod}
                  onClick={() => ozgartir({ kategoriya: filtr.kategoriya === k.kod ? undefined : k.kod })}
                  title={k.guruh === "muammo" ? t("u.muammo") : t("u.vosita")}
                >
                  <i
                    aria-hidden
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: k.guruh === "muammo" ? "var(--hl-muammo-line)" : "var(--hl-vosita-line)" }}
                  />
                  {katNomi(k.kod, k.nomi)} <span className="tabular-nums opacity-80">{katSanoq.get(k.kod) ?? 0}</span>
                </button>
              ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Korsatkich nomi={t("ms.k.misollar")} qiymat={royxat.length} />
            <Korsatkich nomi={t("ms.k.materiallar")} qiymat={materiallarSoni} />
            <Korsatkich nomi={t("ms.k.tanlangan")} qiymat={tanlanganSoni} />
            <Korsatkich
              nomi={t("ms.k.tasdiq")}
              qiymat={ekspertKorgan.length ? `${son((tasdiqlangan / ekspertKorgan.length) * 100, 0)}%` : "—"}
              izoh={ekspertKorgan.length ? t("ms.k.tasdiqIzoh", { n: ekspertKorgan.length }) : t("ms.k.tasdiqYoq")}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{t("ms.topildi", { n: royxat.length })}</p>
            <span className="ml-auto" />
            <button className="btn" disabled={!royxat.length} onClick={() => setWordOchiq(true)} title={t("ms.wordTitle")}>
              {t("ms.word")}
            </button>
            <a
              className={`btn ${royxat.length ? "" : "pointer-events-none opacity-50"}`}
              href={`/api/misollar/excel${qator ? `?${qator}` : ""}`}
              title={t("ms.excelTitle")}
            >
              {t("ms.excel")}
            </a>
          </div>

          {royxat.length === 0 ? (
            <Card koarish={false}>
              <p className="py-8 text-center font-semibold">{t("ms.bosh")}</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {royxat.slice(0, soni).map((m) => (
                <MisolKarta key={m.id} m={m} onTanlash={() => tanlash(m)} />
              ))}
              {royxat.length > soni && (
                <div className="flex flex-col items-center gap-2 py-2">
                  <p className="hint">{t("ms.korsatilmoqda", { a: soni, b: royxat.length })}</p>
                  <button className="btn" onClick={() => setSoni((s) => s + SAHIFA)}>
                    {t("ms.yana", { n: Math.min(SAHIFA, royxat.length - soni) })}
                  </button>
                </div>
              )}
            </div>
          )}

          {korpus.fragmentsiz > 0 && <p className="hint">{t("ms.fragmentsiz", { n: korpus.fragmentsiz })}</p>}

          <WordOynasi ochiq={wordOchiq} yopish={() => setWordOchiq(false)} misollar={royxat} />
        </>
      )}
    </div>
  );
}

/** Bitta misol: kategoriya, gap ichida ajratilgan fragment, manba, ekspertlar tasdig‘i va ★. */
function MisolKarta({ m, onTanlash }: { m: Misol; onTanlash: () => void }) {
  const { t, atama, media } = useTil();
  const k = m.kontekst;
  const vosita = m.guruh === "vosita";
  return (
    <article className="card !p-4 sm:!p-5" style={{ borderLeft: `4px solid ${vosita ? "var(--hl-vosita-line)" : "var(--hl-muammo-line)"}` }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold">{atama.kategoriya(m.kategoriya, m.kategoriya_nomi)}</span>
        <span className="tag">{t(m.qism === "sarlavha" ? "u.sarlavha" : m.qism === "lid" ? "u.lid" : "u.matn")}</span>
        {!m.toliq && <span className="tag">{t("u.toliqEmas")}</span>}
        <span className="ml-auto" />
        {m.ekspertlar > 0 && (
          <span
            className="tag tabular-nums"
            title={t("ms.tasdiqTitle", { a: m.tasdiq, b: m.ekspertlar })}
            style={m.tasdiq > 0 ? { borderColor: "var(--ok)", color: "var(--ok)" } : undefined}
          >
            {m.tasdiq > 0 ? "✓ " : ""}
            {t("ms.tasdiq", { a: m.tasdiq, b: m.ekspertlar })}
          </span>
        )}
        <button
          className="btn btn-sm"
          aria-pressed={m.tanlangan}
          onClick={onTanlash}
          title={m.tanlangan ? t("ms.tanlanganTitle") : t("ms.tanlashTitle")}
          style={m.tanlangan ? { background: "var(--brand)", borderColor: "var(--brand)", color: "var(--brand-ink)" } : undefined}
        >
          {m.tanlangan ? "★" : "☆"} {m.tanlangan ? t("ms.tanlangan") : t("ms.tanlash")}
        </button>
      </div>

      <p className="mt-3 text-[15px] leading-[1.7]" style={{ color: "var(--ink)" }}>
        {k ? (
          <>
            {k.oldin}
            <mark className={`hl ${vosita ? "vosita" : ""}`} style={{ cursor: "text" }}>
              {k.fragment}
            </mark>
            {k.keyin}
          </>
        ) : (
          <>«{m.fragment}»</>
        )}
      </p>
      {!k && <p className="hint mt-1">{t("ms.topilmadi")}</p>}
      {m.izoh && (
        <p className="mt-2 text-[13.5px] italic" style={{ color: "var(--ink-2)" }}>
          — {m.izoh}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]" style={{ color: "var(--muted)" }}>
        <span className="font-semibold" style={{ color: "var(--ink-2)" }}>
          {m.nashr}
        </span>
        <span>· {media(m.turi)}</span>
        {m.sana && <span>· {sanaFormat(m.sana)}</span>}
        <span>· {m.janr === JANR_YOQ ? t("u.janrYoq") : atama.janr(m.janr)}</span>
        <span className="min-w-0 max-w-full truncate" title={m.sarlavha}>
          · «{m.sarlavha}»
        </span>
        <span className="ml-auto flex items-center gap-1">
          {m.havola && (
            <a className="btn btn-ghost btn-sm" href={m.havola} target="_blank" rel="noreferrer noopener" title={m.havola}>
              ↗
            </a>
          )}
          <Link className="btn btn-ghost btn-sm" href={`/tahlil/${m.material_id}`} title={t("ms.tahlilgaTitle")}>
            {t("ms.tahlilga")} →
          </Link>
        </span>
      </div>
    </article>
  );
}

function Korsatkich({ nomi, qiymat, izoh }: { nomi: string; qiymat: number | string; izoh?: string }) {
  return (
    <div className="card !p-4">
      <div className="eyebrow">{nomi}</div>
      <div className="mt-1.5 text-[26px] font-extrabold leading-none tabular-nums">{qiymat}</div>
      {izoh && <p className="hint mt-1.5 !text-[12px]">{izoh}</p>}
    </div>
  );
}
