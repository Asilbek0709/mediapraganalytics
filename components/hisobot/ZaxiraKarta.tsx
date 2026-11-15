"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { useTil } from "@/components/i18n/TilProvider";
import { Card, CardHead } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { api, xatoMatni } from "@/lib/client";
import { sanaVaqt } from "@/lib/format";
import type { Kalit } from "@/lib/i18n";
import type { Zaxira, ZaxiraHolati } from "@/lib/zaxira";
import type { Statistika, ZaxiraTuri } from "@/lib/zaxiraFormat";

const TUR_RANGI: Record<ZaxiraTuri, string> = {
  qolda: "var(--accent)",
  avto: "var(--muted)",
  tiklashdan_oldin: "var(--lvl-1)",
  yuklangan: "var(--s3)",
};

/** Taqqoslash jadvalidagi qatorlar: kalit va «ko‘proq — yaxshi» (kamaysa ogohlantiriladi). */
const QATORLAR: [keyof Statistika, Kalit][] = [
  ["nashrlar", "zx.r.nashrlar"],
  ["materiallar", "zx.r.materiallar"],
  ["tahlillar", "zx.r.tahlillar"],
  ["belgilar", "zx.r.belgilar"],
  ["ekspertlar", "zx.r.ekspertlar"],
  ["ekspert_tahlillari", "zx.r.ekspertTahlillari"],
  ["metodika_versiya", "zx.r.metodika"],
  ["oxirgi_ozgarish", "zx.r.oxirgi"],
];

/** Nusxalar ro‘yxati ustunlari (sm va kengroq ekranlarda) */
const USTUNLAR = "sm:grid-cols-[132px_170px_72px_minmax(0,1fr)_auto]";

function yuklabOlish(nom: string) {
  const a = document.createElement("a");
  a.href = `/api/zaxira/${encodeURIComponent(nom)}`;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function ZaxiraKarta({ boshHolat }: { boshHolat: ZaxiraHolati }) {
  const { t, son } = useTil();
  const toast = useToast();
  const router = useRouter();
  const [holat, setHolat] = useState(boshHolat);
  const [band, setBand] = useState(false);
  const [yangi, setYangi] = useState<string | null>(null);
  const [tanlangan, setTanlangan] = useState<Zaxira | null>(null);
  const [dialogOchiq, setDialogOchiq] = useState(false);
  const faylRef = useRef<HTMLInputElement>(null);

  const hajm = (b: number) =>
    b < 1024 * 1024 ? t("zx.kb", { v: son(Math.max(1, b / 1024), 0) }) : t("zx.mb", { v: son(b / 1024 / 1024, 1) });
  const tarkib = (s: Statistika) =>
    [
      t("zx.nMaterial", { n: s.materiallar }),
      t("zx.nTahlil", { n: s.tahlillar }),
      t("zx.nBelgi", { n: s.belgilar }),
      ...(s.ekspertlar ? [t("zx.nEkspert", { n: s.ekspertlar })] : []),
    ].join(" · ");

  async function bajarish(fn: () => Promise<void>) {
    setBand(true);
    try {
      await fn();
    } catch (e) {
      toast(xatoMatni(e), "error");
    } finally {
      setBand(false);
    }
  }

  const yangilash = async () => setHolat(await api.get<ZaxiraHolati>("/api/zaxira"));

  const yaratish = (yukla: boolean) =>
    bajarish(async () => {
      const { nom } = await api.post<{ nom: string }>("/api/zaxira");
      setYangi(nom);
      await yangilash();
      toast(t("zx.yaratildi", { v: nom }));
      if (yukla) yuklabOlish(nom);
    });

  const fayldan = (fayl: File) =>
    bajarish(async () => {
      const forma = new FormData();
      forma.append("fayl", fayl);
      const res = await fetch("/api/zaxira/yuklash", { method: "POST", body: forma });
      const data = (await res.json().catch(() => ({}))) as { nom?: string; detail?: string };
      if (!res.ok) throw new Error(data.detail ?? t("u.xatolik", { s: res.status }));
      setYangi(data.nom ?? null);
      await yangilash();
      toast(t("zx.yuklandi"));
    });

  const ochirish = (z: Zaxira) => {
    if (!confirm(t("zx.ochirishTasdiq", { v: z.nom }))) return;
    void bajarish(async () => {
      await api.del(`/api/zaxira/${encodeURIComponent(z.nom)}`);
      await yangilash();
      toast(t("zx.ochirildi"));
    });
  };

  const tiklash = (z: Zaxira) =>
    bajarish(async () => {
      const r = await api.post<{ oldingi: string }>(`/api/zaxira/${encodeURIComponent(z.nom)}/tiklash`);
      setDialogOchiq(false);
      setYangi(r.oldingi);
      await yangilash();
      toast(t("zx.tiklandi", { v: r.oldingi }));
      router.refresh();
    });

  const s = holat.statistika;
  const qiymat = (st: Statistika, k: keyof Statistika) => {
    const v = st[k];
    if (k === "oxirgi_ozgarish") return v ? sanaVaqt(String(v)) : "—";
    if (k === "metodika_versiya") return v == null ? "—" : `v${v}`;
    return String(v);
  };

  return (
    <Card>
      <CardHead
        title={t("hs.zaxira")}
        izoh={t("zx.izoh")}
        ong={
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={band} onClick={() => yaratish(false)}>
              {t("zx.yaratish")}
            </button>
            <button className="btn" disabled={band} onClick={() => yaratish(true)}>
              {t("zx.yaratishYukla")}
            </button>
            <button className="btn" disabled={band} onClick={() => faylRef.current?.click()}>
              {t("zx.fayldan")}
            </button>
            <input
              ref={faylRef}
              type="file"
              accept=".gz,.json.gz,.db,.sqlite,.sqlite3"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void fayldan(f);
              }}
            />
          </div>
        }
      />

      <div className="rounded-xl border px-4 py-3" style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="eyebrow">{t("zx.joriy")}</span>
          <span className="mono font-bold">{holat.baza}</span>
          {holat.hajm != null && <span className="hint">{hajm(holat.hajm)}</span>}
          {s.metodika_versiya != null && <span className="tag">{t("u.metodikaV", { v: s.metodika_versiya })}</span>}
        </div>
        <p className="mt-1 text-[13.5px] font-semibold">{tarkib(s)}</p>
        {s.oxirgi_ozgarish && <p className="hint">{t("zx.oxirgiOzgarish", { v: sanaVaqt(s.oxirgi_ozgarish) })}</p>}
      </div>

      {holat.zaxiralar.length === 0 ? (
        <p className="hint py-6 text-center">{t("zx.royxatBosh")}</p>
      ) : (
        // Jadval o‘rniga to‘r: kompyuterda bir qator, telefonda sana/tur/hajm — tarkib — tugmalar ustma-ust
        <div className="mt-3" role="table" aria-label={t("hs.zaxira")}>
          <div
            role="row"
            className={`hidden gap-x-3 border-b-2 px-2 pb-2 text-[11.5px] font-bold uppercase tracking-wide sm:grid ${USTUNLAR}`}
            style={{ borderColor: "var(--line-strong)", color: "var(--muted)" }}
          >
            <span role="columnheader">{t("zx.u.sana")}</span>
            <span role="columnheader">{t("zx.u.tur")}</span>
            <span role="columnheader" className="text-right">
              {t("zx.u.hajm")}
            </span>
            <span role="columnheader">{t("zx.u.tarkib")}</span>
            <span />
          </div>
          {holat.zaxiralar.map((z) => (
            <div
              key={z.nom}
              role="row"
              className={`grid grid-cols-[auto_auto_1fr] items-center gap-x-3 gap-y-1.5 border-b px-2 py-2.5 transition-colors hover:bg-[var(--surface-2)] ${USTUNLAR}`}
              style={{ borderColor: "var(--line)", ...(z.nom === yangi ? { background: "var(--accent-soft)" } : {}) }}
            >
              <span role="cell" className="whitespace-nowrap font-semibold" title={z.nom}>
                {sanaVaqt(z.sana)}
              </span>
              <span role="cell">
                <span className="tag whitespace-nowrap" style={{ borderColor: TUR_RANGI[z.tur], color: TUR_RANGI[z.tur] }}>
                  {t(`zx.t.${z.tur}`)}
                </span>
              </span>
              <span role="cell" className="text-right tabular-nums">
                {hajm(z.hajm)}
              </span>
              <span role="cell" className="col-span-3 text-[13px] sm:col-span-1">
                {z.statistika ? (
                  <>
                    {tarkib(z.statistika)}
                    {z.statistika.metodika_versiya != null && <span className="hint"> · v{z.statistika.metodika_versiya}</span>}
                  </>
                ) : (
                  <span style={{ color: "var(--danger)" }}>{t("zx.oqilmadi")}</span>
                )}
              </span>
              <span role="cell" className="col-span-3 flex justify-end gap-1 sm:col-span-1">
                <button className="btn btn-sm" disabled={band} onClick={() => yuklabOlish(z.nom)}>
                  {t("zx.yuklab")}
                </button>
                <button
                  className="btn btn-sm"
                  disabled={band || !z.statistika}
                  onClick={() => {
                    setTanlangan(z);
                    setDialogOchiq(true);
                  }}
                >
                  {t("zx.tiklash")}
                </button>
                <button className="btn btn-sm btn-ghost" disabled={band} onClick={() => ochirish(z)} title={t("u.ochirish")} aria-label={t("u.ochirish")}>
                  ✕
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="hint mt-3">
        {t("zx.avtoIzoh", { a: holat.saqlanadi.avto ?? 0, b: holat.saqlanadi.tiklashdan_oldin ?? 0 })}
      </p>
      <p className="mt-2 text-[13px] font-semibold [overflow-wrap:anywhere]" style={{ color: "var(--lvl-1)" }}>
        {t("zx.papkaIzoh")}
      </p>

      {tanlangan?.statistika && (
        <Dialog
          open={dialogOchiq}
          onClose={() => setDialogOchiq(false)}
          title={t("zx.d.sarlavha")}
          footer={
            <>
              <button className="btn" onClick={() => setDialogOchiq(false)} disabled={band}>
                {t("u.bekor")}
              </button>
              <button className="btn btn-danger" onClick={() => tiklash(tanlangan)} disabled={band}>
                {t("zx.tiklash")}
              </button>
            </>
          }
        >
          <p>{t("zx.d.izoh")}</p>
          <p className="mono mt-2 break-all">{tanlangan.nom}</p>
          <div className="table-wrap mt-3">
            <table className="data">
              <thead>
                <tr>
                  <th>{t("zx.d.korsatkich")}</th>
                  <th className="num">{t("zx.d.hozir")}</th>
                  <th className="num">{t("zx.d.nusxada")}</th>
                </tr>
              </thead>
              <tbody>
                {QATORLAR.map(([k, kalit]) => {
                  const hozir = s[k];
                  const nusxa = tanlangan.statistika![k];
                  const kamaydi = typeof hozir === "number" && typeof nusxa === "number" && nusxa < hozir && k !== "metodika_versiya";
                  const farq = hozir !== nusxa;
                  return (
                    <tr key={k}>
                      <td className="font-semibold">{t(kalit)}</td>
                      <td className="num">{qiymat(s, k)}</td>
                      <td
                        className="num"
                        style={{ color: kamaydi ? "var(--danger)" : undefined, fontWeight: farq ? 700 : undefined }}
                      >
                        {qiymat(tanlangan.statistika!, k)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {tanlangan.statistika.materiallar < s.materiallar && (
            <p className="mt-3 text-[13.5px] font-semibold" style={{ color: "var(--danger)" }}>
              {t("zx.d.kamroq", { n: s.materiallar - tanlangan.statistika.materiallar })}
            </p>
          )}
        </Dialog>
      )}
    </Card>
  );
}
