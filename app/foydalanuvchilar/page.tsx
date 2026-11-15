import { FoydalanuvchilarView } from "@/components/auth/FoydalanuvchilarView";
import { foydalanuvchilar } from "@/lib/auth";
import { all } from "@/lib/db";
import { sahifaSarlavhasi } from "@/lib/i18n/server";
import { sahifaTalab } from "@/lib/sessiya";

export const dynamic = "force-dynamic";
export const generateMetadata = () => sahifaSarlavhasi("au.foydalanuvchilar");

export default async function FoydalanuvchilarSahifasi() {
  const f = await sahifaTalab(["admin"]);
  const [royxat, ekspertlar] = await Promise.all([
    foydalanuvchilar(),
    all<{ id: number; ism: string }>("SELECT id, ism FROM ekspertlar ORDER BY ism"),
  ]);
  return <FoydalanuvchilarView boshlangich={royxat} ekspertlar={ekspertlar} joriyId={f.id} />;
}
