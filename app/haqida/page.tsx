import { BoshSahifaView } from "@/components/bosh/BoshSahifaView";
import { sahifaSarlavhasi } from "@/lib/i18n/server";
import { ochiqMalumot } from "@/lib/ochiq";
import { joriyFoydalanuvchi } from "@/lib/sessiya";

export const dynamic = "force-dynamic";
export const generateMetadata = () => sahifaSarlavhasi("bh.haqida");

/** Platforma haqida — hamma uchun ochiq; kirgan foydalanuvchiga «Panelga o‘tish» tugmasi bilan. */
export default async function HaqidaSahifasi() {
  const f = await joriyFoydalanuvchi().catch(() => null);
  return <BoshSahifaView m={await ochiqMalumot()} kirgan={!!f} />;
}
