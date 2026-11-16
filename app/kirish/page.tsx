import { redirect } from "next/navigation";

import { KirishView } from "@/components/auth/KirishView";
import { royxatOchiqmi, sozlashKalitiKerak, sozlashKerakmi } from "@/lib/auth";
import { sahifaSarlavhasi } from "@/lib/i18n/server";
import { boshSahifa, qaytishManzili } from "@/lib/ruxsat";
import { joriyFoydalanuvchi } from "@/lib/sessiya";

export const dynamic = "force-dynamic";
export const generateMetadata = () => sahifaSarlavhasi("au.kirish");

export default async function KirishSahifasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const keyin = typeof sp.keyin === "string" ? sp.keyin : null;
  const f = await joriyFoydalanuvchi();
  if (f) redirect(f.parol_almashtirilsin ? "/profil" : keyin ? qaytishManzili(keyin, f.rol) : boshSahifa(f.rol));
  return <KirishView sozlash={await sozlashKerakmi()} kalitKerak={sozlashKalitiKerak()} keyin={keyin} royxatOchiq={await royxatOchiqmi()} />;
}
