import { ProfilView } from "@/components/auth/ProfilView";
import { one } from "@/lib/db";
import { sahifaSarlavhasi } from "@/lib/i18n/server";
import { boshSahifa } from "@/lib/ruxsat";
import { sahifaTalab } from "@/lib/sessiya";

export const dynamic = "force-dynamic";
export const generateMetadata = () => sahifaSarlavhasi("au.profil");

export default async function ProfilSahifasi() {
  const f = await sahifaTalab();
  const e = f.ekspert_id ? await one<{ ism: string }>("SELECT ism FROM ekspertlar WHERE id = ?", [f.ekspert_id]) : null;
  return (
    <ProfilView
      p={{ ism: f.ism, email: f.email, rol: f.rol, ekspert: e?.ism ?? null, majburiy: f.parol_almashtirilsin, bosh: boshSahifa(f.rol), demo: f.demo }}
    />
  );
}
