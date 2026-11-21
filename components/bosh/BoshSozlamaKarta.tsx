"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useTil } from "@/components/i18n/TilProvider";
import { Card, CardHead } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { api, xatoMatni } from "@/lib/client";
import type { Kalit } from "@/lib/i18n";
import type { Til } from "@/lib/i18n/til";
import type { BoshMatnlar } from "@/lib/ochiq";

const MAVZU_MAYDONLARI: { til: Til; nomi: Kalit }[] = [
  { til: "uz", nomi: "bh.mavzuUz" },
  { til: "ru", nomi: "bh.mavzuRu" },
  { til: "en", nomi: "bh.mavzuEn" },
];

/** Administrator: ochiq bosh sahifadagi mavzu va muallif, parolsiz demo rejimini yoqish/o‘chirish. */
export function BoshSozlamaKarta({ boshMatnlar, demoOchiq: boshDemo }: { boshMatnlar: BoshMatnlar; demoOchiq: boolean }) {
  const { t } = useTil();
  const toast = useToast();
  const [demo, setDemo] = useState(boshDemo);
  const [matnlar, setMatnlar] = useState(boshMatnlar);
  const [band, setBand] = useState(false);

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

  const demoniAlmashtir = (ochiq: boolean) =>
    bajarish(async () => {
      await api.put("/api/foydalanuvchilar/demo", { ochiq });
      setDemo(ochiq);
      toast(t("au.royxatSaqlandi"));
    });

  const saqlash = (e: React.FormEvent) => {
    e.preventDefault();
    void bajarish(async () => {
      setMatnlar(await api.put<BoshMatnlar>("/api/bosh-sahifa", matnlar));
      toast(t("bh.saqlandi"));
    });
  };

  return (
    <Card koarish={false} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <CardHead
        title={t("bh.sozlama")}
        izoh={t("bh.sozlamaIzoh")}
        ong={
          <Link className="btn btn-sm" href="/haqida">
            <ExternalLink size={14} />
            {t("bh.haqida")}
          </Link>
        }
      />
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" className="mt-1 h-4 w-4" checked={demo} disabled={band} onChange={(e) => void demoniAlmashtir(e.target.checked)} />
        <span>
          <span className="block text-[14px] font-bold">{t("bh.demoOchiq")}</span>
          <span className="hint">{t("bh.demoOchiqIzoh")}</span>
        </span>
      </label>

      <form onSubmit={saqlash} className="mt-5 grid gap-3">
        <div className="grid gap-3 lg:grid-cols-3">
          {MAVZU_MAYDONLARI.map(({ til, nomi }) => (
            <label key={til} className="field">
              <span>{t(nomi)}</span>
              <textarea
                rows={3}
                maxLength={600}
                value={matnlar.mavzu[til]}
                onChange={(e) => setMatnlar((m) => ({ ...m, mavzu: { ...m.mavzu, [til]: e.target.value } }))}
              />
            </label>
          ))}
        </div>
        <p className="hint -mt-1">{t("bh.mavzuBoshIzoh")}</p>
        <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,420px)_auto]">
          <label className="field">
            <span>{t("bh.muallif")}</span>
            <input type="text" maxLength={200} value={matnlar.muallif} onChange={(e) => setMatnlar((m) => ({ ...m, muallif: e.target.value }))} />
          </label>
          <button type="submit" className="btn btn-primary justify-self-start" disabled={band}>
            {band ? t("u.saqlanmoqda") : t("u.saqlash")}
          </button>
        </div>
      </form>
    </Card>
  );
}
