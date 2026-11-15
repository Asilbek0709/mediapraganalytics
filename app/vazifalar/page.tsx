import { redirect } from "next/navigation";

import { VazifalarView } from "@/components/ekspertlar/VazifalarView";
import { ekspertVazifalari } from "@/lib/ekspert";
import { sahifaSarlavhasi, serverTarjimon } from "@/lib/i18n/server";
import { sahifaTalab } from "@/lib/sessiya";

export const dynamic = "force-dynamic";
export const generateMetadata = () => sahifaSarlavhasi("au.vazifalar");

export default async function VazifalarSahifasi() {
  const f = await sahifaTalab(["admin", "ekspert"]);
  if (!f.ekspert_id) {
    // Administrator ekspertlar bo‘limidan ishlaydi; bog‘lanmagan ekspert — tushuntirish
    if (f.rol === "admin") redirect("/ekspertlar");
    const { t } = await serverTarjimon();
    return (
      <div className="card !p-6">
        <h1>{t("au.vazifalar")}</h1>
        <p className="mt-3 font-semibold" style={{ color: "var(--lvl-1)" }}>
          {t("au.bogLanmaganIzoh")}
        </p>
      </div>
    );
  }
  const d = await ekspertVazifalari(f.ekspert_id);
  return <VazifalarView ekspert={d.ekspert} vazifalar={d.vazifalar} vaznlar={d.vaznlar} mezonlar={d.mezonlar} />;
}
