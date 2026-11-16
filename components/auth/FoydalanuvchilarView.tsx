"use client";

import { motion } from "framer-motion";
import { useState } from "react";

import { useTil } from "@/components/i18n/TilProvider";
import { Card, CardHead } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import type { FoydalanuvchiQatori } from "@/lib/auth";
import { api, xatoMatni } from "@/lib/client";
import { sanaVaqt } from "@/lib/format";
import { ROLLAR, type Rol } from "@/lib/ruxsat";

interface Ekspert {
  id: number;
  ism: string;
}

export function FoydalanuvchilarView({
  boshlangich,
  ekspertlar,
  joriyId,
  royxatOchiq: boshRoyxat = true,
}: {
  boshlangich: FoydalanuvchiQatori[];
  ekspertlar: Ekspert[];
  joriyId: number;
  /** kirish sahifasida ochiq ro‘yxatdan o‘tish yoqilganmi */
  royxatOchiq?: boolean;
}) {
  const { t } = useTil();
  const toast = useToast();
  const [royxat, setRoyxat] = useState(boshlangich);
  const [band, setBand] = useState(false);
  const [yangi, setYangi] = useState({ ism: "", email: "", rol: "ekspert" as Rol, ekspert_id: "" });
  const [parolOyna, setParolOyna] = useState<{ kim: string; parol: string } | null>(null);
  const [royxatOchiq, setRoyxatOchiq] = useState(boshRoyxat);
  // o‘zi ro‘yxatdan o‘tgan, hali kuzatuvchi bo‘lib turgan foydalanuvchilar — administrator ko‘rib chiqishi uchun
  const yangiRoyxat = royxat.filter((f) => f.ozi_royxatdan && f.rol === "kuzatuvchi").length;

  const royxatniAlmashtir = (ochiq: boolean) =>
    bajarish(async () => {
      await api.put("/api/foydalanuvchilar/royxat", { ochiq });
      setRoyxatOchiq(ochiq);
      toast(t("au.royxatSaqlandi"));
    });

  const yangilash = async () => setRoyxat(await api.get<FoydalanuvchiQatori[]>("/api/foydalanuvchilar"));
  const bandEkspertlar = new Set(royxat.map((f) => f.ekspert_id).filter(Boolean));

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

  const yaratish = (e: React.FormEvent) => {
    e.preventDefault();
    void bajarish(async () => {
      const r = await api.post<{ id: number; parol: string }>("/api/foydalanuvchilar", {
        ...yangi,
        ekspert_id: yangi.rol === "ekspert" && yangi.ekspert_id ? Number(yangi.ekspert_id) : null,
      });
      setParolOyna({ kim: yangi.email, parol: r.parol });
      setYangi({ ism: "", email: "", rol: yangi.rol, ekspert_id: "" });
      await yangilash();
    });
  };

  const tahrirlash = (f: FoydalanuvchiQatori, q: Partial<{ rol: Rol; faol: boolean }>) =>
    bajarish(async () => {
      await api.put(`/api/foydalanuvchilar/${f.id}`, { ...q, ekspert_id: f.ekspert_id });
      await yangilash();
      toast(t("au.saqlandi"));
    });

  const parolTiklash = (f: FoydalanuvchiQatori) => {
    if (!confirm(t("au.tiklashTasdiq", { v: f.email }))) return;
    void bajarish(async () => {
      const r = await api.post<{ parol: string }>(`/api/foydalanuvchilar/${f.id}/parol`);
      setParolOyna({ kim: f.email, parol: r.parol });
      await yangilash();
    });
  };

  const ochirish = (f: FoydalanuvchiQatori) => {
    if (!confirm(t("au.ochirishTasdiq", { v: f.email }))) return;
    void bajarish(async () => {
      await api.del(`/api/foydalanuvchilar/${f.id}`);
      await yangilash();
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1>{t("au.foydalanuvchilar")}</h1>
        <p className="hint mt-2 max-w-[80ch]">{t("au.foydalanuvchilarIzoh")}</p>
      </motion.header>

      <Card koarish={false} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={royxatOchiq}
            disabled={band}
            onChange={(e) => void royxatniAlmashtir(e.target.checked)}
          />
          <span>
            <span className="block text-[14px] font-bold">
              {t("au.royxatOchiq")}
              {yangiRoyxat > 0 && <span className="tag ml-2 !text-[11.5px]">{t("au.yangiRoyxat", { n: yangiRoyxat })}</span>}
            </span>
            <span className="hint">{t("au.royxatOchiqIzoh")}</span>
          </span>
        </label>
      </Card>

      <Card koarish={false} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <CardHead title={t("au.yangiHisob")} />
        <form onSubmit={yaratish} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_1fr_auto]">
          <label className="field">
            <span>{t("au.ism")}</span>
            <input type="text" required maxLength={200} value={yangi.ism} onChange={(e) => setYangi({ ...yangi, ism: e.target.value })} />
          </label>
          <label className="field">
            <span>{t("au.email")}</span>
            <input type="email" required value={yangi.email} onChange={(e) => setYangi({ ...yangi, email: e.target.value })} />
          </label>
          <label className="field">
            <span>{t("au.rol")}</span>
            <select value={yangi.rol} onChange={(e) => setYangi({ ...yangi, rol: e.target.value as Rol })}>
              {ROLLAR.map((r) => (
                <option key={r} value={r}>
                  {t(`au.rol.${r}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t("au.ekspertYozuvi")}</span>
            <select
              value={yangi.ekspert_id}
              disabled={yangi.rol !== "ekspert"}
              onChange={(e) => setYangi({ ...yangi, ekspert_id: e.target.value })}
            >
              <option value="">{t("au.yangiEkspert")}</option>
              {ekspertlar
                .filter((e) => !bandEkspertlar.has(e.id))
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.ism}
                  </option>
                ))}
            </select>
          </label>
          <button className="btn btn-primary" type="submit" disabled={band}>
            {t("au.yaratish")}
          </button>
        </form>
        <ul className="hint mt-3 flex flex-col gap-0.5">
          {ROLLAR.map((r) => (
            <li key={r}>
              <b>{t(`au.rol.${r}`)}</b> — {t(`au.rolIzoh.${r}`)}
            </li>
          ))}
        </ul>
      </Card>

      <Card koarish={false}>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{t("au.ism")}</th>
                <th>{t("au.email")}</th>
                <th>{t("au.rol")}</th>
                <th>{t("au.ekspertYozuvi")}</th>
                <th>{t("au.holat")}</th>
                <th>{t("au.oxirgiKirish")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {royxat.map((f) => {
                const ozi = f.id === joriyId;
                return (
                  <tr key={f.id} style={f.faol ? undefined : { opacity: 0.6 }}>
                    <td className="font-semibold">
                      {f.ism} {ozi && <span className="hint">({t("au.siz")})</span>}
                      {f.ozi_royxatdan && (
                        <span className="tag ml-1.5 !text-[11px]" title={sanaVaqt(f.yaratilgan)}>
                          {t("au.oziRoyxat")}
                        </span>
                      )}
                    </td>
                    <td className="mono">{f.email}</td>
                    <td>
                      <select
                        className="!w-auto !py-1"
                        value={f.rol}
                        disabled={band || ozi}
                        onChange={(e) => void tahrirlash(f, { rol: e.target.value as Rol })}
                      >
                        {ROLLAR.map((r) => (
                          <option key={r} value={r}>
                            {t(`au.rol.${r}`)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{f.rol === "ekspert" ? (f.ekspert_ism ?? <span className="hint">{t("au.bogLanmagan")}</span>) : "—"}</td>
                    <td>
                      <span className="tag" style={f.faol ? { borderColor: "var(--ok)", color: "var(--ok)" } : undefined}>
                        {f.faol ? t("au.faol") : t("au.ochirilgan")}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">{f.oxirgi_kirish ? sanaVaqt(f.oxirgi_kirish) : <span className="hint">{t("au.hechQachon")}</span>}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button className="btn btn-sm" disabled={band} onClick={() => parolTiklash(f)}>
                          {t("au.parolTiklash")}
                        </button>
                        {!ozi && (
                          <button className="btn btn-sm" disabled={band} onClick={() => void tahrirlash(f, { faol: !f.faol })}>
                            {f.faol ? t("au.faolsizlantirish") : t("au.faollashtirish")}
                          </button>
                        )}
                        {!ozi && (
                          <button className="btn btn-sm btn-ghost" disabled={band} onClick={() => ochirish(f)} aria-label={t("u.ochirish")} title={t("u.ochirish")}>
                            ✕
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog
        open={!!parolOyna}
        onClose={() => setParolOyna(null)}
        title={t("au.vaqtinchalikParol")}
        footer={
          <button className="btn btn-primary" onClick={() => setParolOyna(null)}>
            {t("u.yopish")}
          </button>
        }
      >
        {parolOyna && (
          <>
            <p className="mono">{parolOyna.kim}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="mono rounded-lg border px-3 py-2 text-[18px] font-bold tracking-wider" style={{ borderColor: "var(--line-strong)" }}>
                {parolOyna.parol}
              </code>
              <button
                className="btn btn-sm"
                onClick={() =>
                  navigator.clipboard
                    .writeText(parolOyna.parol)
                    .then(() => toast(t("au.nusxalandi")))
                    .catch(() => {})
                }
              >
                {t("au.nusxa")}
              </button>
            </div>
            <p className="mt-3 text-[13.5px] font-semibold" style={{ color: "var(--lvl-1)" }}>
              {t("au.parolIzoh")}
            </p>
          </>
        )}
      </Dialog>
    </div>
  );
}
