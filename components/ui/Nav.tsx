"use client";

import { motion, useScroll, useSpring } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useTil } from "@/components/i18n/TilProvider";
import type { Kalit } from "@/lib/i18n";
import { Sozlamalar } from "./Sozlamalar";

const LINKS: [string, Kalit][] = [
  ["/", "nav.bosh"],
  ["/mediabaza", "nav.mediabaza"],
  ["/analitika", "nav.analitika"],
  ["/misollar", "nav.misollar"],
  ["/metodika", "nav.metodika"],
  ["/ekspertlar", "nav.ekspertlar"],
  ["/hisobot", "nav.hisobot"],
];

function faolmi(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/mediabaza") return pathname.startsWith("/mediabaza") || pathname.startsWith("/tahlil");
  if (href === "/ekspertlar") return pathname.startsWith("/ekspertlar") || pathname.startsWith("/kelishuv");
  return pathname.startsWith(href);
}

export function Nav() {
  const pathname = usePathname();
  const { t } = useTil();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 26, restDelta: 0.001 });

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-xl"
      style={{ borderColor: "var(--line)", background: "color-mix(in oklab, var(--surface) 86%, transparent)" }}
    >
      <motion.div
        className="absolute inset-x-0 bottom-0 h-[3px] origin-left"
        style={{ scaleX: progress, background: "linear-gradient(90deg, var(--s1), var(--s2))" }}
      />
      <div className="mx-auto flex w-full max-w-[1340px] flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3">
        <Link href="/" className="group flex items-center gap-3 no-underline">
          <motion.span
            className="grid h-10 w-10 place-items-center rounded-xl text-[13px] font-extrabold tracking-wide"
            style={{ background: "var(--brand)", color: "var(--brand-ink)" }}
            whileHover={{ rotate: -6, scale: 1.06 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          >
            MP
          </motion.span>
          <span className="leading-tight">
            <span className="block text-[15px] font-extrabold" style={{ color: "var(--ink)" }}>
              MediaPrag-Analytics
            </span>
            <span className="block max-w-[300px] text-[11.5px]" style={{ color: "var(--muted)" }}>
              {t("nav.brendSub")}
            </span>
          </span>
        </Link>

        <nav className="ml-auto flex flex-wrap items-center gap-1">
          {LINKS.map(([href, kalit]) => {
            const faol = faolmi(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                className="relative rounded-[10px] px-3 py-2 text-[13.5px] font-semibold no-underline transition-colors"
                style={{ color: faol ? "var(--brand-ink)" : "var(--ink-2)" }}
              >
                {faol && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 -z-10 rounded-[10px]"
                    style={{ background: "var(--brand)" }}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                {t(kalit)}
              </Link>
            );
          })}
        </nav>
        <Sozlamalar />
      </div>
    </header>
  );
}
