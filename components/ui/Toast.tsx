"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, CircleAlert } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { spring } from "./motion";

type Tur = "ok" | "error";
interface Xabar {
  id: number;
  matn: string;
  tur: Tur;
}

const ToastContext = createContext<(matn: string, tur?: Tur) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [xabarlar, setXabarlar] = useState<Xabar[]>([]);

  const toast = useCallback((matn: string, tur: Tur = "ok") => {
    const id = Date.now() + Math.random();
    setXabarlar((oldingi) => [...oldingi, { id, matn, tur }]);
    setTimeout(() => setXabarlar((o) => o.filter((x) => x.id !== id)), tur === "error" ? 6500 : 3600);
  }, []);

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-[70px] z-[100] lg:top-5 flex w-[min(400px,calc(100vw-2rem))] flex-col gap-2">
        <AnimatePresence initial={false}>
          {xabarlar.map((x) => (
            <motion.div
              key={x.id}
              layout
              initial={{ opacity: 0, x: 60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.92, transition: { duration: 0.18 } }}
              transition={spring}
              className="toast pointer-events-auto flex items-start gap-3 px-4 py-3 text-[13.5px] font-semibold"
              data-tur={x.tur}
            >
              <span className="toast-belgi">{x.tur === "error" ? <CircleAlert size={16} strokeWidth={2.4} /> : <Check size={16} strokeWidth={2.6} />}</span>
              <span className="min-w-0 flex-1 pt-px">{x.matn}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
