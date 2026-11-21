"use client";

import { Eye, LogIn } from "lucide-react";

import { chiqibOtish } from "@/components/auth/ProfilView";
import { useTil } from "@/components/i18n/TilProvider";

/** Demo rejimida har sahifa ustida: faqat ko‘rish ekanligi, o‘z hisobi bilan kirish va demo’dan chiqish. */
export function DemoBanner() {
  const { t } = useTil();
  return (
    <div className="demo-banner sahifa-kirish mb-5" role="status">
      <span className="demo-banner-belgi flex-none" aria-hidden>
        <Eye size={17} strokeWidth={2.3} />
      </span>
      {/* tor ekranda tugmalar keyingi qatorga o‘tadi — matn ustunga siqilmaydi */}
      <p className="min-w-0 flex-[1_1_240px] text-[13.5px] font-semibold">{t("bh.demoBanner")}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-sm" onClick={() => void chiqibOtish("/kirish")}>
          <LogIn size={14} />
          {t("au.kirish")}
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => void chiqibOtish("/")}>
          {t("bh.demoChiqish")}
        </button>
      </div>
    </div>
  );
}
