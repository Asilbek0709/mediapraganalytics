"use client";

import { motion } from "framer-motion";
import { Monitor, Moon, Sun } from "lucide-react";

import { useTil } from "@/components/i18n/TilProvider";
import { TILLAR, type Mavzu } from "@/lib/i18n/til";

const pill = { type: "spring", stiffness: 420, damping: 34 } as const;
const MAVZU_TARTIBI: Mavzu[] = ["light", "system", "dark"];

function useMavzular() {
  const { t } = useTil();
  return [
    { kalit: "light" as Mavzu, nomi: t("nav.yorug"), belgi: <Sun size={15} strokeWidth={2.2} /> },
    { kalit: "system" as Mavzu, nomi: t("nav.tizim"), belgi: <Monitor size={15} strokeWidth={2.2} /> },
    { kalit: "dark" as Mavzu, nomi: t("nav.qorongi"), belgi: <Moon size={15} strokeWidth={2.2} /> },
  ];
}

/**
 * Til (UZ / RU / EN) va ko‘rinish (yorug‘ / tizim / qorong‘i) tanlagichlari.
 * `ixcham` — yig‘ilgan yon menyu uchun: ikki kichik tugma, har bosishda keyingi qiymat.
 * `id` — bir sahifada ikki nusxa bo‘lsa (yon menyu va mobil oyna), plashkalar aralashmasligi uchun.
 */
export function Sozlamalar({ ixcham = false, id = "sb" }: { ixcham?: boolean; id?: string }) {
  const { til, setTil, mavzu, setMavzu, t, almashmoqda } = useTil();
  const mavzular = useMavzular();

  if (ixcham) {
    const joriyMavzu = mavzular.find((m) => m.kalit === mavzu) ?? mavzular[1];
    const keyingiMavzu = MAVZU_TARTIBI[(MAVZU_TARTIBI.indexOf(mavzu) + 1) % MAVZU_TARTIBI.length];
    const tilIndeks = TILLAR.findIndex((x) => x.kod === til);
    const keyingiTil = TILLAR[(tilIndeks + 1) % TILLAR.length];
    return (
      <div className="flex flex-col items-center gap-1">
        <button
          className="icon-btn"
          title={`${t("nav.korinish")}: ${joriyMavzu.nomi}`}
          aria-label={`${t("nav.korinish")}: ${joriyMavzu.nomi}`}
          onClick={(e) => setMavzu(keyingiMavzu, { x: e.clientX, y: e.clientY })}
        >
          <motion.span key={mavzu} initial={{ rotate: -90, scale: 0.5 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 14 }}>
            {joriyMavzu.belgi}
          </motion.span>
        </button>
        <button
          className="icon-btn text-[11.5px] font-extrabold tracking-wide"
          title={`${t("nav.til")}: ${TILLAR[tilIndeks]?.nomi}`}
          aria-label={`${t("nav.til")}: ${TILLAR[tilIndeks]?.nomi}`}
          onClick={() => setTil(keyingiTil.kod)}
          style={{ opacity: almashmoqda ? 0.6 : 1 }}
        >
          {TILLAR[tilIndeks]?.qisqa}
        </button>
      </div>
    );
  }

  const guruh = "flex flex-1 rounded-[12px] border p-[3px]";
  const guruhUslubi = { borderColor: "var(--line)", background: "color-mix(in oklab, var(--surface-2) 70%, transparent)" };

  return (
    <div className="flex w-full items-center gap-2">
      <div role="radiogroup" aria-label={t("nav.til")} className={guruh} style={{ ...guruhUslubi, opacity: almashmoqda ? 0.7 : 1 }}>
        {TILLAR.map((x) => {
          const faol = x.kod === til;
          return (
            <button
              key={x.kod}
              role="radio"
              aria-checked={faol}
              title={x.nomi}
              onClick={() => !faol && setTil(x.kod)}
              className="relative flex-1 rounded-[9px] py-1 text-[11.5px] font-extrabold tracking-wide transition-colors"
              style={{ color: faol ? "#fff" : "var(--ink-2)" }}
            >
              {faol && (
                <motion.span
                  layoutId={`${id}-til-pill`}
                  className="absolute inset-0 rounded-[9px]"
                  style={{ background: "var(--brand-grad)", boxShadow: "var(--glow)" }}
                  transition={pill}
                />
              )}
              <span className="relative">{x.qisqa}</span>
            </button>
          );
        })}
      </div>

      <div role="radiogroup" aria-label={t("nav.korinish")} className={guruh} style={guruhUslubi}>
        {mavzular.map((m) => {
          const faol = m.kalit === mavzu;
          return (
            <button
              key={m.kalit}
              role="radio"
              aria-checked={faol}
              aria-label={m.nomi}
              title={m.nomi}
              onClick={(e) => !faol && setMavzu(m.kalit, { x: e.clientX, y: e.clientY })}
              className="relative grid h-[25px] flex-1 place-items-center rounded-[9px] transition-colors"
              style={{ color: faol ? "#fff" : "var(--ink-2)" }}
            >
              {faol && (
                <motion.span
                  layoutId={`${id}-mavzu-pill`}
                  className="absolute inset-0 rounded-[9px]"
                  style={{ background: "var(--brand-grad)", boxShadow: "var(--glow)" }}
                  transition={pill}
                />
              )}
              <motion.span
                className="relative"
                key={`${m.kalit}-${faol}`}
                initial={faol ? { rotate: -90, scale: 0.6 } : false}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 14 }}
              >
                {m.belgi}
              </motion.span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
