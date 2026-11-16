"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { CircleAlert, ShieldCheck } from "lucide-react";

import { useFoydalanuvchi } from "@/components/auth/FoydalanuvchiProvider";
import { AiBelgiTaklifi, AiMaydonTaklifi, AiPanel, type AiNatija, type AiTaklif, type Qaror } from "./AiTaklif";
import { LpsiGauge, MezonBars } from "@/components/charts/LpsiGauge";
import { useTil } from "@/components/i18n/TilProvider";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { fadeUp, pressable, spring, stagger } from "@/components/ui/motion";
import { api, xatoMatni } from "@/lib/client";
import { hozirgiVaqt, idRaqami, sana, sanaVaqt } from "@/lib/format";
import type { Kalit } from "@/lib/i18n";
import type { Belgi, Kategoriya, Material, MetodikaTolik, Natija, Qism, Tahlil } from "@/lib/types";

const QISM_TARTIB: Record<Qism, number> = { sarlavha: 0, lid: 1, matn: 2 };

interface Holat {
  sarlavha_turlari: string[];
  kompozitsiya: string | null;
  sar_lid: string | null;
  lid_matn: string | null;
  sar_matn: string | null;
  auditoriya: number | null;
  izoh: string;
}

const boshHolat = (): Holat => ({
  sarlavha_turlari: [],
  kompozitsiya: null,
  sar_lid: null,
  lid_matn: null,
  sar_matn: null,
  auditoriya: null,
  izoh: "",
});

// ------------------------------------------------------------- kichik qismlar

function Blok({
  harf,
  title,
  manba,
  izoh,
  children,
}: {
  harf: string;
  title: string;
  manba: string;
  izoh?: string;
  children: ReactNode;
}) {
  return (
    <Card variants={fadeUp} koarish={false}>
      <div className="mb-3.5 flex items-center gap-3">
        <motion.span
          className="grid h-7 w-7 flex-none place-items-center rounded-lg text-[12.5px] font-extrabold"
          style={{ background: "var(--brand-grad)", color: "var(--brand-ink)" }}
          whileHover={{ rotate: -10, scale: 1.1 }}
          transition={{ type: "spring", stiffness: 400, damping: 14 }}
        >
          {harf}
        </motion.span>
        <h2 className="min-w-0">{title}</h2>
        <span className="ml-auto whitespace-nowrap text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>
          {manba}
        </span>
      </div>
      {izoh && <p className="hint mb-3">{izoh}</p>}
      {children}
    </Card>
  );
}

function Seg({
  options,
  value,
  onChange,
}: {
  options: { kod: string; nomi: string }[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <motion.button
          key={o.kod}
          type="button"
          className="chip"
          data-on={value === o.kod}
          onClick={() => onChange(o.kod)}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.95 }}
          transition={spring}
        >
          {o.nomi}
        </motion.button>
      ))}
    </div>
  );
}

function ChipsKop({
  options,
  values,
  onToggle,
}: {
  options: { kod: string; nomi: string }[];
  values: string[];
  onToggle: (kod: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <motion.button
          key={o.kod}
          type="button"
          className="chip"
          data-on={values.includes(o.kod)}
          onClick={() => onToggle(o.kod)}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.95 }}
          transition={spring}
        >
          {o.nomi}
        </motion.button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ asosiy

export type Baholovchi = { tur: "asosiy" } | { tur: "ekspert"; id: number; ism: string };

export interface BaholovchilarRoyxati {
  asosiy_bor: boolean;
  ekspertlar: { id: number; ism: string; bor: number }[];
}

export function TahlilView({
  material,
  tahlil: saqlangan,
  belgilar: saqlanganBelgilar,
  natija: boshlangichNatija,
  met,
  baholovchi = { tur: "asosiy" },
  baholovchilar,
  qaytish = { href: "/mediabaza", kalit: "nav.mediabaza" },
  ai,
}: {
  material: Material;
  tahlil: Tahlil | null;
  belgilar: Belgi[];
  natija: Natija | null;
  met: MetodikaTolik;
  baholovchi?: Baholovchi;
  baholovchilar?: BaholovchilarRoyxati;
  /** «orqaga» havolasi: administratorga — Mediabaza, ekspertga — Vazifalarim */
  qaytish?: { href: string; kalit: Kalit };
  /** AI-taklif mavjud bo‘lsa (administrator, asosiy qatlam, kalit o‘rnatilgan va yoqilgan) — kutilayotgan takliflar */
  ai?: { kutilayotgan: AiNatija | null };
}) {
  const toast = useToast();
  const router = useRouter();
  const { t, son, atama, mediaQ, qism: qismNomi, izohMatni } = useTil();
  const { admin } = useFoydalanuvchi();
  // ТЗ v2: tekshirilmagan (masalan, OCR) material tahlilga o‘tmaydi
  const [tekshirilgan, setTekshirilgan] = useState(material.tekshirilgan !== false);
  const AUDITORIYA = (["1", "2", "3", "4", "5"] as const).map((kod) => ({ kod, nomi: t(`th.aud.${kod}`) }));
  const lugatVariantlari = (turkum: string) =>
    (met.lugat[turkum] ?? []).map((o) => ({ kod: o.kod, nomi: atama.lugat(turkum, o.kod, o.nomi) }));
  const ekspertRejimi = baholovchi.tur === "ekspert";
  const apiYol =
    baholovchi.tur === "ekspert"
      ? `/api/materiallar/${material.id}/ekspertlar/${baholovchi.id}`
      : `/api/materiallar/${material.id}/tahlil`;
  const kodlaganlar = (baholovchilar?.asosiy_bor ? 1 : 0) + (baholovchilar?.ekspertlar.filter((e) => e.bor).length ?? 0);

  const kategoriyalar = useMemo(
    () => Object.fromEntries(met.kategoriyalar.map((k) => [k.kod, k])) as Record<string, Kategoriya>,
    [met.kategoriyalar],
  );

  const [holat, setHolat] = useState<Holat>(() => {
    if (!saqlangan) return boshHolat();
    return {
      sarlavha_turlari: saqlangan.sarlavha_turlari ?? [],
      kompozitsiya: saqlangan.kompozitsiya ?? null,
      sar_lid: saqlangan.sar_lid ?? null,
      lid_matn: saqlangan.lid_matn ?? null,
      sar_matn: saqlangan.sar_matn ?? null,
      auditoriya: saqlangan.auditoriya ?? null,
      izoh: saqlangan.izoh ?? "",
    };
  });
  const [belgilar, setBelgilar] = useState<Belgi[]>(() =>
    saqlanganBelgilar.map((b) => ({ ...b, fragment: b.fragment ?? "", izoh: b.izoh ?? "" })),
  );
  const [natija, setNatija] = useState<Natija | null>(boshlangichNatija);
  const [ozgardi, setOzgardi] = useState(false);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);
  const [saqlanganVaqt, setSaqlanganVaqt] = useState<string | null>(saqlangan?.yangilangan ?? null);
  const [songgi, setSonggi] = useState<number | null>(null);
  const [tanlov, setTanlov] = useState<{ qism: Qism; fragment: string; x: number; y: number } | null>(null);
  // AI-taklif: takliflar va tadqiqotchining hali saqlanmagan qarorlari (saqlashda yoziladi)
  const [aiNatija, setAiNatija] = useState<AiNatija | null>(ai?.kutilayotgan ?? null);
  const [aiQarorlar, setAiQarorlar] = useState<Record<number, Qaror>>({});
  const [aiYuklanmoqda, setAiYuklanmoqda] = useState(false);

  const sorovNo = useRef(0);
  const popRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------- hisoblash

  const payload = useCallback(
    () => ({
      ...holat,
      izoh: holat.izoh || null,
      belgilar: belgilar.map((b) => ({
        kategoriya: b.kategoriya,
        qism: b.qism,
        fragment: b.fragment || null,
        izoh: b.izoh || null,
        holat: b.holat ?? "qolda",
        tasdiqlagan: b.tasdiqlagan ?? null,
        tasdiq_sanasi: b.tasdiq_sanasi ?? null,
        ai_taklif_id: b.ai_taklif_id ?? null,
      })),
      ai_qarorlar: Object.entries(aiQarorlar).map(([id, qaror]) => ({ id: Number(id), qaror })),
    }),
    [holat, belgilar, aiQarorlar],
  );

  // ---------------------------------------------------------- AI-taklif

  async function aiOlish() {
    if (Object.keys(aiQarorlar).length && !confirm(t("th.yoqoladi"))) return;
    setAiYuklanmoqda(true);
    try {
      const n = await api.post<AiNatija>(`/api/materiallar/${material.id}/ai-taklif`);
      setBelgilar((bs) => bs.filter((b) => !b.ai_taklif_id));
      setAiQarorlar({});
      setAiNatija(n);
    } catch (e) {
      toast(xatoMatni(e), "error");
    } finally {
      setAiYuklanmoqda(false);
    }
  }

  function qarorYoz(id: number, q: Qaror | null) {
    setAiQarorlar((p) => {
      const n = { ...p };
      if (q) n[id] = q;
      else delete n[id];
      return n;
    });
    setOzgardi(true);
  }

  function maydonQarori(tk: AiTaklif, q: Qaror | null) {
    qarorYoz(tk.id, q);
    // tasdiqlash va o‘zgartirish — qiymat formaga qo‘yiladi (o‘zgartirishda keyin tadqiqotchi tuzatadi)
    if (q === "tasdiqlangan" || q === "ozgartirilgan") yangilash({ [tk.blok]: tk.qiymat } as Partial<Holat>);
  }

  function belgiQarori(tk: AiTaklif, q: Qaror | null, kategoriya?: string) {
    const b = tk.qiymat as { kategoriya: string; qism: Qism; fragment: string };
    qarorYoz(tk.id, q);
    setBelgilar((bs) => {
      const qolgan = bs.filter((x) => x.ai_taklif_id !== tk.id);
      if (q !== "tasdiqlangan" && q !== "ozgartirilgan") return qolgan;
      return [
        ...qolgan,
        {
          kategoriya: q === "ozgartirilgan" && kategoriya ? kategoriya : b.kategoriya,
          qism: b.qism,
          fragment: b.fragment,
          izoh: "",
          holat: q === "tasdiqlangan" ? "ai_tasdiqlangan" : "ai_ozgartirilgan",
          ai_taklif_id: tk.id,
        },
      ];
    });
  }

  const aiQiymatNomi = (tk: AiTaklif) => {
    const nom = (turkum: string, kod: string) => lugatVariantlari(turkum).find((o) => o.kod === kod)?.nomi ?? kod;
    if (tk.blok === "sarlavha_turlari") return (tk.qiymat as string[]).map((k) => nom("sarlavha_turi", k)).join(", ") || t("ai.bosh");
    return nom(tk.blok === "kompozitsiya" ? "kompozitsiya" : "muvofiqlik", String(tk.qiymat));
  };
  const aiMaydon = (blok: AiTaklif["blok"]) => {
    const tk = aiNatija?.takliflar.find((x) => x.blok === blok);
    if (!tk) return null;
    return <AiMaydonTaklifi key={tk.id} taklif={tk} qiymatNomi={aiQiymatNomi(tk)} qaror={aiQarorlar[tk.id]} onQaror={(q) => maydonQarori(tk, q)} />;
  };
  const aiBelgilar = (guruh: "muammo" | "vosita") =>
    (aiNatija?.takliflar ?? []).filter(
      (x) => x.blok === "belgi" && kategoriyalar[(x.qiymat as { kategoriya: string }).kategoriya]?.guruh === guruh,
    );

  useEffect(() => {
    if (!ozgardi) return;
    const t = setTimeout(async () => {
      const no = ++sorovNo.current;
      try {
        const n = await api.post<Natija>("/api/hisoblash", payload());
        if (no === sorovNo.current) setNatija(n);
      } catch (e) {
        toast(xatoMatni(e), "error");
      }
    }, 220);
    return () => clearTimeout(t);
  }, [holat, belgilar, ozgardi, payload, toast]);

  const yangilash = (yangi: Partial<Holat>) => {
    setHolat((h) => ({ ...h, ...yangi }));
    setOzgardi(true);
  };

  // ---------------------------------------------------------- belgilar

  function belgiQoshish(kategoriya: string, qism: Qism, fragment: string) {
    setBelgilar((b) => [...b, { kategoriya, qism, fragment, izoh: "" }]);
    setSonggi(belgilar.length);
    setOzgardi(true);
  }

  function belgiOchirish(i: number) {
    setBelgilar((b) => b.filter((_, j) => j !== i));
    setSonggi(null);
    setOzgardi(true);
  }

  function belgiIzohi(i: number, izoh: string) {
    setBelgilar((b) => b.map((x, j) => (j === i ? { ...x, izoh } : x)));
    setOzgardi(true);
  }

  // ---------------------------------------------------------- matn belgilash

  useEffect(() => {
    function onMouseUp(e: MouseEvent) {
      if (popRef.current?.contains(e.target as Node)) return;
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount) return setTanlov(null);
        const range = sel.getRangeAt(0);
        const qismEl = (
          range.startContainer.nodeType === 1 ? (range.startContainer as Element) : range.startContainer.parentElement
        )?.closest("[data-qism]");
        const tugash = (
          range.endContainer.nodeType === 1 ? (range.endContainer as Element) : range.endContainer.parentElement
        )?.closest("[data-qism]");
        const fragment = sel.toString().trim();
        if (!qismEl || qismEl !== tugash || !fragment) return setTanlov(null);
        const rect = range.getBoundingClientRect();
        setTanlov({
          qism: qismEl.getAttribute("data-qism") as Qism,
          fragment,
          x: Math.min(Math.max(12, rect.left), window.innerWidth - 360),
          y: rect.bottom + 10,
        });
      }, 0);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setTanlov(null);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saqlash();
      }
    }
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  useEffect(() => {
    const onScroll = () => setTanlov(null);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, []);

  useEffect(() => {
    const ogohlantir = (e: BeforeUnloadEvent) => {
      if (ozgardi) e.preventDefault();
    };
    window.addEventListener("beforeunload", ogohlantir);
    return () => window.removeEventListener("beforeunload", ogohlantir);
  }, [ozgardi]);

  // ---------------------------------------------------------- saqlash

  async function saqlash() {
    setSaqlanmoqda(true);
    try {
      const n = await api.put<Natija>(apiYol, payload());
      sorovNo.current++;
      setNatija(n);
      if (aiNatija && Object.keys(aiQarorlar).length) {
        const hal = new Set(Object.keys(aiQarorlar).map(Number));
        const qolgan = aiNatija.takliflar.filter((x) => !hal.has(x.id));
        setAiNatija(qolgan.length ? { ...aiNatija, takliflar: qolgan, tashlandi: 0 } : null);
        setAiQarorlar({});
        setBelgilar((bs) => bs.map((b) => ({ ...b, ai_taklif_id: null })));
      }
      setOzgardi(false);
      setSaqlanganVaqt(hozirgiVaqt());
      toast(
        n.lpsi == null ? t("th.saqlandiToliqEmas") : t("th.saqlandi", { v: son(n.lpsi), d: atama.daraja(n.daraja) }),
      );
      router.refresh();
    } catch (e) {
      toast(xatoMatni(e), "error");
    } finally {
      setSaqlanmoqda(false);
    }
  }

  async function tozalash() {
    if (!confirm(t("th.tozalashTasdiq"))) return;
    try {
      await api.del(apiYol);
      setHolat(boshHolat());
      setBelgilar([]);
      setNatija(null);
      setOzgardi(false);
      setSaqlanganVaqt(null);
      toast(t("th.tozalandi"));
      router.refresh();
    } catch (e) {
      toast(xatoMatni(e), "error");
    }
  }

  // ---------------------------------------------------------- matn bo‘laklari

  function matnBolaklari(qism: Qism, matn: string): ReactNode {
    const oraliqlar: { boshi: number; oxiri: number; items: number[] }[] = [];
    belgilar.forEach((b, i) => {
      if (b.qism !== qism || !b.fragment) return;
      let dan = 0;
      let joy: number;
      while ((joy = matn.indexOf(b.fragment, dan)) !== -1) {
        const oxiri = joy + b.fragment.length;
        const ayni = oraliqlar.find((r) => r.boshi === joy && r.oxiri === oxiri);
        if (ayni) {
          ayni.items.push(i);
          break;
        }
        if (!oraliqlar.some((r) => joy < r.oxiri && oxiri > r.boshi)) {
          oraliqlar.push({ boshi: joy, oxiri, items: [i] });
          break;
        }
        dan = joy + 1;
      }
    });
    oraliqlar.sort((a, b) => a.boshi - b.boshi);

    const nodes: ReactNode[] = [];
    let kursor = 0;
    oraliqlar.forEach((r, idx) => {
      if (r.boshi > kursor) nodes.push(matn.slice(kursor, r.boshi));
      const kats = r.items.map((i) => kategoriyalar[belgilar[i].kategoriya]).filter(Boolean);
      const muammomi = kats.some((k) => k.guruh === "muammo");
      const sarlavhaMatni = r.items
        .map((i) => `${atama.kategoriya(belgilar[i].kategoriya, kategoriyalar[belgilar[i].kategoriya]?.nomi)}${belgilar[i].izoh ? ` — ${belgilar[i].izoh}` : ""}`)
        .join("\n");
      nodes.push(
        <mark
          key={`${qism}-${idx}-${r.boshi}`}
          className={`hl ${muammomi ? "" : "vosita"} ${songgi != null && r.items.includes(songgi) ? "yangi" : ""}`}
          title={sarlavhaMatni}
        >
          {matn.slice(r.boshi, r.oxiri)}
        </mark>,
      );
      kursor = r.oxiri;
    });
    if (kursor < matn.length) nodes.push(matn.slice(kursor));
    return nodes;
  }

  const belgiRoyxati = (guruh: "muammo" | "vosita") =>
    belgilar
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => kategoriyalar[b.kategoriya]?.guruh === guruh)
      .sort(
        (x, y) =>
          QISM_TARTIB[x.b.qism] - QISM_TARTIB[y.b.qism] ||
          (kategoriyalar[x.b.kategoriya]?.tartib ?? 0) - (kategoriyalar[y.b.kategoriya]?.tartib ?? 0) ||
          x.i - y.i,
      );

  const muvofiqlik = lugatVariantlari("muvofiqlik");
  const vositalarTavsifiy = met.kategoriyalar.filter((k) => k.guruh === "vosita").every((k) => !k.mezon || !k.jarima);

  return (
    <div className="flex flex-col gap-5">
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div className="min-w-0">
          <Link href={qaytish.href} className="text-[12.5px] font-semibold">
            ← {t(qaytish.kalit)}
          </Link>
          <h1 className="mt-1.5">
            {t("th.sarlavha")}{" "}
            <span className="tabular-nums" style={{ color: "var(--muted)" }}>
              № {idRaqami(material.id)}
            </span>
          </h1>
          {baholovchilar && (
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <label className="field !flex-row items-center !gap-2">
                <span className="whitespace-nowrap">{t("th.baholovchi")}</span>
                <select
                  className="!w-auto !py-1.5 font-semibold"
                  value={baholovchi.tur === "ekspert" ? String(baholovchi.id) : "asosiy"}
                  onChange={(e) => {
                    if (ozgardi && !confirm(t("th.yoqoladi"))) return;
                    const v = e.target.value;
                    router.push(v === "asosiy" ? `/tahlil/${material.id}` : `/tahlil/${material.id}?ekspert=${v}`);
                  }}
                >
                  <option value="asosiy">
                    {t("th.asosiyVariant")}{baholovchilar.asosiy_bor ? " ✓" : ""}
                  </option>
                  {baholovchilar.ekspertlar.map((e) => (
                    <option key={e.id} value={e.id}>
                      {t("th.ekspertVariant", { v: e.ism })}
                      {e.bor ? " ✓" : ""}
                    </option>
                  ))}
                </select>
              </label>
              {kodlaganlar >= 2 && (
                <Link className="btn btn-sm" href={`/kelishuv/${material.id}`}>
                  {t("th.kelishuvKorish", { n: kodlaganlar })}
                </Link>
              )}
              {!baholovchilar.ekspertlar.length && (
                <Link className="text-[12.5px] font-semibold" href="/ekspertlar">
                  {t("th.ekspertQoshish")}
                </Link>
              )}
            </div>
          )}
          <div className="mt-2.5 flex flex-wrap gap-2">
            <span className="tag">
              {material.nashr} · {mediaQ(material.turi)}
            </span>
            {material.sana && <span className="tag">{sana(material.sana)}</span>}
            {material.janr && <span className="tag">{t("th.janrTeg", { v: atama.janr(material.janr) })}</span>}
            {material.mavzu && <span className="tag">{t("th.mavzuTeg", { v: material.mavzu })}</span>}
            {material.havola && (
              <a className="tag" href={material.havola} target="_blank" rel="noopener noreferrer">
                {t("th.manba")}
              </a>
            )}
            {material.manba_turi && material.manba_turi !== "qolda" && <span className="tag">{t(`mb.mt.${material.manba_turi}`)}</span>}
            {material.olingan_sana && <span className="tag">{t("mb.m.olingan", { v: sanaVaqt(material.olingan_sana) })}</span>}
            {admin && material.arxiv_bor && (
              <a className="tag" href={`/api/materiallar/${material.id}/arxiv`}>
                {t("mb.m.asl")} ↓
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {!ekspertRejimi && (
          <motion.a
            className="btn"
            href={`/api/materiallar/${material.id}/pdf`}
            target="_blank"
            rel="noopener"
            onClick={(e) => {
              if (ozgardi && !confirm(t("th.pdfTasdiq"))) e.preventDefault();
            }}
            {...pressable}
          >
            {t("th.pdf")}
          </motion.a>
          )}
          <motion.button className="btn btn-danger" onClick={tozalash} {...pressable}>
            {t("th.tozalash")}
          </motion.button>
          <motion.button className="btn btn-primary" onClick={saqlash} disabled={saqlanmoqda || !tekshirilgan} {...pressable}>
            {saqlanmoqda ? t("u.saqlanmoqda") : t("u.saqlash")}
          </motion.button>
        </div>
      </motion.header>

      {!tekshirilgan && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-[13.5px]"
          style={{ background: "color-mix(in oklab, var(--lvl-1) 14%, transparent)", border: "1px solid color-mix(in oklab, var(--lvl-1) 45%, transparent)" }}
        >
          <CircleAlert size={18} style={{ color: "var(--lvl-1)" }} className="flex-none" />
          <span className="min-w-0 flex-1 font-semibold">{t("x.tekshirilmagan")}</span>
          {admin && (
            <button
              className="btn btn-sm btn-primary"
              onClick={async () => {
                try {
                  await api.put(`/api/materiallar/${material.id}/tekshiruv`, { tekshirilgan: true });
                  setTekshirilgan(true);
                  toast(t("mb.tekshiruvSaqlandi"));
                  router.refresh();
                } catch (e) {
                  toast(xatoMatni(e), "error");
                }
              }}
            >
              <ShieldCheck size={15} />
              {t("mb.tekshirildiTugma")}
            </button>
          )}
        </motion.div>
      )}

      {baholovchi.tur === "ekspert" && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border-2 px-4 py-3 text-[13px]"
          style={{ borderColor: "var(--s3)", background: "color-mix(in oklab, var(--s3) 8%, var(--surface))" }}
        >
          <strong>{t("th.ekspertRejimi", { v: baholovchi.ism })}</strong> {t("th.ekspertRejimiIzoh")}
        </motion.div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* ------------------------------------------------ matn paneli */}
        <Card
          koarish={false}
          className="scroll-thin xl:sticky xl:top-6 xl:max-h-[calc(100dvh-48px)] xl:overflow-y-auto"
          initial={{ opacity: 0, x: -14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="card-title">
            <h2>{t("th.mediamatn")}</h2>
            <p className="hint">{t("th.belgilangIzoh")}</p>
          </div>
          <div className="flex flex-col gap-4">
            {(["sarlavha", "lid", "matn"] as Qism[]).map((qism) => {
              const matn = (material[qism === "matn" ? "matn" : qism] as string | null) ?? "";
              return (
                <div key={qism} className="border-t pt-3.5 first:border-t-0 first:pt-0" style={{ borderColor: "var(--line)" }}>
                  <div className="eyebrow mb-1.5">{qismNomi(qism)}</div>
                  <div
                    data-qism={qism}
                    className={
                      qism === "sarlavha"
                        ? "whitespace-pre-wrap text-[19px] font-bold leading-snug"
                        : qism === "lid"
                          ? "whitespace-pre-wrap font-semibold leading-relaxed"
                          : "whitespace-pre-wrap leading-[1.75]"
                    }
                  >
                    {matn ? (
                      matnBolaklari(qism, matn)
                    ) : (
                      <span className="italic" style={{ color: "var(--muted)" }}>
                        {t("th.kiritilmagan", { v: qismNomi(qism) })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ------------------------------------------------ o‘ng ustun */}
        <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="flex flex-col gap-4">
          <Card variants={fadeUp} koarish={false}>
            <div className="card-title">
              <h2>{t("iz.lpsiNomi")}</h2>
              <p className="hint">{t("u.metodikaV", { v: natija?.metodika_versiya ?? met.versiya })}</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 sm:justify-start">
              <LpsiGauge lpsi={natija?.lpsi ?? null} daraja={natija?.daraja ?? null} shkala={met.shkala} />
              <div className="min-w-[220px] flex-1">
                <MezonBars mezonlar={met.mezonlar} natija={natija ?? { izohlar: {} }} />
              </div>
            </div>
            <AnimatePresence>
              {natija && natija.yetishmaydi.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 overflow-hidden"
                >
                  <div
                    className="rounded-xl border-2 border-dashed px-4 py-3 text-[13px] font-semibold"
                    style={{ borderColor: "var(--line-strong)", color: "var(--ink-2)" }}
                  >
                    {t("th.yetishmaydi", { v: natija.yetishmaydi.map((y) => t(`iz.${y}`)).join(", ") })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>

          {ai && !ekspertRejimi && tekshirilgan && (
            <motion.div variants={fadeUp}>
              <AiPanel
                natija={aiNatija}
                yuklanmoqda={aiYuklanmoqda}
                onOlish={aiOlish}
                kutilmoqda={(aiNatija?.takliflar.length ?? 0) - Object.keys(aiQarorlar).length}
              />
            </motion.div>
          )}

          <Blok harf="A" title={t("th.bA")} manba={t("th.mA")}>
            <div className="flex flex-col gap-4">
              <div>
                <div className="mb-2 text-[13px] font-bold">
                  {t("th.sarlavhaTuri")} <span className="hint font-medium">{t("th.birNechta")}</span>
                </div>
                <ChipsKop
                  options={lugatVariantlari("sarlavha_turi")}
                  values={holat.sarlavha_turlari}
                  onToggle={(kod) =>
                    yangilash({
                      sarlavha_turlari: holat.sarlavha_turlari.includes(kod)
                        ? holat.sarlavha_turlari.filter((k) => k !== kod)
                        : [...holat.sarlavha_turlari, kod],
                    })
                  }
                />
                {aiMaydon("sarlavha_turlari")}
              </div>
              <div>
                <div className="mb-2 text-[13px] font-bold">{t("th.lidMosligi")}</div>
                <Seg options={muvofiqlik} value={holat.sar_lid} onChange={(v) => yangilash({ sar_lid: v })} />
              </div>
              <div>
                <div className="mb-2 text-[13px] font-bold">{t("iz.kompozitsiya")}</div>
                <Seg
                  options={lugatVariantlari("kompozitsiya")}
                  value={holat.kompozitsiya}
                  onChange={(v) => yangilash({ kompozitsiya: v })}
                />
                {aiMaydon("kompozitsiya")}
              </div>
            </div>
          </Blok>

          <Blok harf="B" title={t("th.bB")} manba={t("th.mB")}>
            <div className="flex flex-col divide-y" style={{ borderColor: "var(--line)" }}>
              {(["sar_lid", "lid_matn", "sar_matn"] as const).map((maydon) => (
                <div key={maydon} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="w-[190px] text-[13px] font-semibold">{t(`iz.${maydon}`)}</span>
                  <Seg options={muvofiqlik} value={holat[maydon]} onChange={(v) => yangilash({ [maydon]: v })} />
                  {aiNatija?.takliflar.some((x) => x.blok === maydon) && <div className="w-full">{aiMaydon(maydon)}</div>}
                </div>
              ))}
            </div>
            <motion.div
              key={natija?.k1 ?? "yoq"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 rounded-xl px-3.5 py-2.5 text-[13px]"
              style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
            >
              {natija?.k1 == null ? (
                t("th.k1Kutish")
              ) : (
                <>
                  {t("th.k1")} <strong>{son(natija.k1)}%</strong>{" "}
                  <span className="mono" style={{ color: "var(--muted)" }}>
                    {izohMatni(natija.izohlar?.K1)}
                  </span>
                </>
              )}
            </motion.div>
          </Blok>

          {(["muammo", "vosita"] as const).map((guruh) => {
            const royxat = belgiRoyxati(guruh);
            const sanoq = new Map<string, number>();
            royxat.forEach(({ b }) => sanoq.set(b.kategoriya, (sanoq.get(b.kategoriya) ?? 0) + 1));
            return (
              <Blok
                key={guruh}
                harf={guruh === "muammo" ? "C" : "D"}
                title={guruh === "muammo" ? t("th.bC") : t("th.bD")}
                manba={guruh === "muammo" ? t("th.mC") : t("th.mD")}
                izoh={guruh === "muammo" ? t("th.izohC") : vositalarTavsifiy ? t("th.izohD1") : t("th.izohD2")}
              >
                {sanoq.size > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {met.kategoriyalar
                      .filter((k) => sanoq.get(k.kod))
                      .map((k) => (
                        <motion.span key={k.kod} layout className="tag">
                          {atama.kategoriya(k.kod, k.nomi)}: <strong>{sanoq.get(k.kod)}</strong>
                        </motion.span>
                      ))}
                  </div>
                )}
                {aiBelgilar(guruh).length > 0 && (
                  <div className="mb-3 flex flex-col gap-2">
                    <div className="eyebrow">{t("ai.belgilar")}</div>
                    <AnimatePresence initial={false}>
                      {aiBelgilar(guruh).map((tk) => (
                        <AiBelgiTaklifi
                          key={tk.id}
                          taklif={tk}
                          kategoriyalar={met.kategoriyalar.filter((k) => k.guruh === guruh)}
                          kategoriyaNomi={(kod) => atama.kategoriya(kod, kategoriyalar[kod]?.nomi)}
                          qismNomi={qismNomi((tk.qiymat as { qism: Qism }).qism)}
                          qaror={aiQarorlar[tk.id]}
                          onQaror={(q, kat) => belgiQarori(tk, q, kat)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <AnimatePresence initial={false}>
                    {royxat.map(({ b, i }) => {
                      const k = kategoriyalar[b.kategoriya];
                      return (
                        <motion.div
                          key={`${i}-${b.kategoriya}-${b.fragment}`}
                          layout
                          initial={{ opacity: 0, y: -8, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
                          transition={spring}
                          className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border p-3"
                          style={{
                            background: "var(--surface-2)",
                            borderColor: "var(--line)",
                            borderLeft: `4px solid ${guruh === "muammo" ? "var(--hl-muammo-line)" : "var(--hl-vosita-line)"}`,
                          }}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-[13px]">
                              <strong>{atama.kategoriya(b.kategoriya, k?.nomi)}</strong>
                              <span className="tag">{qismNomi(b.qism)}</span>
                              {b.holat && b.holat !== "qolda" && (
                                <span className="ai-belgi" title={t("ai.belgiAiTitle", { v: t(`ai.h.${b.holat}`) })}>
                                  ✦ {t("ai.belgiAi")}
                                </span>
                              )}
                              {k?.mezon && k.jarima ? (
                                <span className="tag">
                                  {k.mezon} −{son(k.jarima)}
                                </span>
                              ) : null}
                            </div>
                            {b.fragment && (
                              <p className="mt-1 text-[13px]" style={{ color: "var(--ink-2)" }}>
                                «{b.fragment}»
                              </p>
                            )}
                            <input
                              type="text"
                              className="mt-2 !py-1.5 text-[12.5px]"
                              placeholder={t("u.izohIxtiyoriy")}
                              value={b.izoh ?? ""}
                              onChange={(e) => belgiIzohi(i, e.target.value)}
                            />
                          </div>
                          <button
                            className="btn btn-sm btn-ghost btn-danger self-start"
                            onClick={() => belgiOchirish(i)}
                            aria-label={t("th.belgiOchirish")}
                          >
                            ✕
                          </button>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  {!royxat.length && (
                    <p className="hint">{t("th.belgiYoq")}</p>
                  )}
                </div>
                <QoshishFormasi
                  kategoriyalar={met.kategoriyalar.filter((k) => k.guruh === guruh)}
                  onQoshish={belgiQoshish}
                />
              </Blok>
            );
          })}

          <Blok harf="E" title={t("th.bE")} manba={t("th.mE")}>
            <div className="mb-2 text-[13px] font-bold">{t("th.audSavol")}</div>
            <Seg
              options={AUDITORIYA}
              value={holat.auditoriya == null ? null : String(holat.auditoriya)}
              onChange={(v) => yangilash({ auditoriya: Number(v) })}
            />
            <label className="field mt-4">
              <span>{t("pdf.tadqiqotchiIzohi")}</span>
              <textarea
                rows={3}
                placeholder={t("th.izohPh")}
                value={holat.izoh}
                onChange={(e) => yangilash({ izoh: e.target.value })}
              />
            </label>
          </Blok>
        </motion.div>
      </div>

      {/* ------------------------------------------------ saqlash paneli */}
      <motion.div
        className="sticky bottom-4 z-30"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, ...spring }}
      >
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 shadow-lg"
          style={{ background: "var(--surface)", borderColor: "var(--line-strong)", boxShadow: "var(--shadow-md)" }}
        >
          <motion.span
            key={ozgardi ? "ozgardi" : (saqlanganVaqt ?? "yoq")}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
            className="text-[13px] font-semibold"
            style={{ color: ozgardi ? "var(--lvl-1)" : "var(--muted)" }}
          >
            {ozgardi
              ? t("th.saqlanmagan")
              : saqlanganVaqt
                ? t("th.saqlangan", { v: sanaVaqt(saqlanganVaqt) })
                : t("th.saqlanmaganHali")}
          </motion.span>
          <div className="flex flex-wrap gap-2.5">
            <Link className="btn" href={qaytish.href}>
              {qaytish.href === "/mediabaza" ? t("th.qaytish") : `← ${t(qaytish.kalit)}`}
            </Link>
            <motion.button className="btn btn-primary" onClick={saqlash} disabled={saqlanmoqda || !tekshirilgan} {...pressable}>
              {t("u.saqlash")}
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* ------------------------------------------------ tanlov oynasi */}
      <AnimatePresence>
        {tanlov && (
          <motion.div
            ref={popRef}
            initial={{ opacity: 0, scale: 0.9, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.12 } }}
            transition={spring}
            onMouseDown={(e) => e.preventDefault()}
            className="fixed z-[80] w-[340px] rounded-2xl border-2 p-3 shadow-lg"
            style={{
              left: tanlov.x,
              top: tanlov.y,
              background: "var(--surface)",
              borderColor: "var(--line-strong)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            {(["muammo", "vosita"] as const).map((guruh) => (
              <div key={guruh} className="mb-2 last:mb-0">
                <div className="eyebrow mb-1.5">
                  {guruh === "muammo" ? t("th.popMuammo") : t("th.popVosita")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {met.kategoriyalar
                    .filter((k) => k.guruh === guruh)
                    .map((k) => (
                      <motion.button
                        key={k.kod}
                        className="chip !px-2.5 !py-1 !text-[12px]"
                        style={{
                          borderLeft: `4px solid ${guruh === "muammo" ? "var(--hl-muammo-line)" : "var(--hl-vosita-line)"}`,
                        }}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => {
                          belgiQoshish(k.kod, tanlov.qism, tanlov.fragment);
                          window.getSelection()?.removeAllRanges();
                          setTanlov(null);
                          toast(t("th.belgiQoshildi", { v: atama.kategoriya(k.kod, k.nomi) }));
                        }}
                      >
                        {atama.kategoriya(k.kod, k.nomi)}
                      </motion.button>
                    ))}
                </div>
              </div>
            ))}
            <p className="hint mt-2 truncate">
              {qismNomi(tanlov.qism)}: «{tanlov.fragment.slice(0, 70)}
              {tanlov.fragment.length > 70 ? "…" : ""}»
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function QoshishFormasi({
  kategoriyalar,
  onQoshish,
}: {
  kategoriyalar: Kategoriya[];
  onQoshish: (kategoriya: string, qism: Qism, fragment: string) => void;
}) {
  const [kategoriya, setKategoriya] = useState("");
  const [qism, setQism] = useState<Qism>("matn");
  const [fragment, setFragment] = useState("");
  const toast = useToast();
  const { t, son, atama } = useTil();

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2.5">
      <label className="field min-w-[160px] flex-1">
        <span>{t("u.kategoriya")}</span>
        <select value={kategoriya} onChange={(e) => setKategoriya(e.target.value)}>
          <option value="">{t("u.tanlang")}</option>
          {kategoriyalar.map((k) => (
            <option key={k.kod} value={k.kod}>
              {atama.kategoriya(k.kod, k.nomi)}
              {k.mezon && k.jarima ? ` (${k.mezon} −${son(k.jarima)})` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="field w-[130px]">
        <span>{t("u.qism")}</span>
        <select value={qism} onChange={(e) => setQism(e.target.value as Qism)}>
          <option value="matn">{t("u.matn")}</option>
          <option value="lid">{t("u.lid")}</option>
          <option value="sarlavha">{t("u.sarlavha")}</option>
        </select>
      </label>
      <label className="field min-w-[160px] flex-1">
        <span>{t("th.fragmentIxtiyoriy")}</span>
        <input type="text" value={fragment} onChange={(e) => setFragment(e.target.value)} />
      </label>
      <motion.button
        className="btn"
        {...pressable}
        onClick={() => {
          if (!kategoriya) return toast(t("th.kategoriyaTanlang"), "error");
          onQoshish(kategoriya, qism, fragment.trim());
          setFragment("");
        }}
      >
        {t("u.qoshish")}
      </motion.button>
    </div>
  );
}
