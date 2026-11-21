import { FoydalanuvchilarView } from "@/components/auth/FoydalanuvchilarView";
import { BoshSozlamaKarta } from "@/components/bosh/BoshSozlamaKarta";
import { demoOchiqmi, foydalanuvchilar, royxatOchiqmi } from "@/lib/auth";
import { all } from "@/lib/db";
import { sahifaSarlavhasi } from "@/lib/i18n/server";
import { boshMatnlar } from "@/lib/ochiq";
import { sahifaTalab } from "@/lib/sessiya";

export const dynamic = "force-dynamic";
export const generateMetadata = () => sahifaSarlavhasi("au.foydalanuvchilar");

export default async function FoydalanuvchilarSahifasi() {
  const f = await sahifaTalab(["admin"]);
  const [royxat, ekspertlar, royxatOchiq, matnlar, demoOchiq] = await Promise.all([
    foydalanuvchilar(),
    all<{ id: number; ism: string }>("SELECT id, ism FROM ekspertlar ORDER BY ism"),
    royxatOchiqmi(),
    boshMatnlar(),
    demoOchiqmi(),
  ]);
  return (
    <div className="flex flex-col gap-5">
      <FoydalanuvchilarView boshlangich={royxat} ekspertlar={ekspertlar} joriyId={f.id} royxatOchiq={royxatOchiq} />
      <BoshSozlamaKarta boshMatnlar={matnlar} demoOchiq={demoOchiq} />
    </div>
  );
}
