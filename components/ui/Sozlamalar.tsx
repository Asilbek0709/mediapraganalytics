"use client";

import { motion } from "framer-motion";

import { useTil } from "@/components/i18n/TilProvider";
import { TILLAR, type Mavzu } from "@/lib/i18n/til";

function Quyosh() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4.2" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line key={a} x1="12" y1="2.5" x2="12" y2="4.8" transform={`rotate(${a} 12 12)`} />
      ))}
    </svg>
  );
}

function Oy() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
      <path d="M20.3 14.6A8.5 8.5 0 0 1 9.4 3.7a8.5 8.5 0 1 0 10.9 10.9Z" />
    </svg>
  );
}

function Tizim() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" />
    </svg>
  );
}

const pill = { type: "spring", stiffness: 420, damping: 34 } as const;

/** Til (UZ / RU / EN) va ko‘rinish (yorug‘ / tizim / qorong‘i) tanlagichlari. */
export function Sozlamalar() {
  const { til, setTil, mavzu, setMavzu, t, almashmoqda } = useTil();
  const mavzular: { kalit: Mavzu; nomi: string; belgi: React.ReactNode }[] = [
    { kalit: "light", nomi: t("nav.yorug"), belgi: <Quyosh /> },
    { kalit: "system", nomi: t("nav.tizim"), belgi: <Tizim /> },
    { kalit: "dark", nomi: t("nav.qorongi"), belgi: <Oy /> },
  ];

  return (
    <div className="flex items-center gap-2">
      <div
        role="radiogroup"
        aria-label={t("nav.til")}
        className="inline-flex rounded-[10px] border p-[3px]"
        style={{ borderColor: "var(--line-strong)", background: "var(--surface-2)", opacity: almashmoqda ? 0.7 : 1 }}
      >
        {TILLAR.map((x) => {
          const faol = x.kod === til;
          return (
            <button
              key={x.kod}
              role="radio"
              aria-checked={faol}
              title={x.nomi}
              onClick={() => !faol && setTil(x.kod)}
              className="relative rounded-[7px] px-2.5 py-1 text-[12px] font-extrabold tracking-wide"
              style={{ color: faol ? "var(--brand-ink)" : "var(--ink-2)" }}
            >
              {faol && <motion.span layoutId="til-pill" className="absolute inset-0 rounded-[7px]" style={{ background: "var(--brand)" }} transition={pill} />}
              <span className="relative">{x.qisqa}</span>
            </button>
          );
        })}
      </div>

      <div
        role="radiogroup"
        aria-label={t("nav.korinish")}
        className="inline-flex rounded-[10px] border p-[3px]"
        style={{ borderColor: "var(--line-strong)", background: "var(--surface-2)" }}
      >
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
              className="relative grid h-[26px] w-[30px] place-items-center rounded-[7px]"
              style={{ color: faol ? "var(--brand-ink)" : "var(--ink-2)" }}
            >
              {faol && <motion.span layoutId="mavzu-pill" className="absolute inset-0 rounded-[7px]" style={{ background: "var(--brand)" }} transition={pill} />}
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
