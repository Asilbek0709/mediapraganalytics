import { redirect } from "next/navigation";

import { BoshSahifaView } from "@/components/bosh/BoshSahifaView";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { dashboard } from "@/lib/analytics";
import { ochiqMalumot } from "@/lib/ochiq";
import { joriyFoydalanuvchi, sahifaTalab } from "@/lib/sessiya";

export const dynamic = "force-dynamic";

/**
 * «/»: kirmagan foydalanuvchiga — ochiq bosh sahifa (platforma, mavzu, LPSI, umumiy ko‘rsatkichlar, «Demo ko‘rish»),
 * kirganga — Dashboard. Yo‘l proxy’da ochiq, shuning uchun vaqtinchalik parol talabi shu yerda tekshiriladi.
 */
export default async function BoshSahifa() {
  const f = await joriyFoydalanuvchi().catch(() => null);
  if (!f) return <BoshSahifaView m={await ochiqMalumot()} kirgan={false} />;
  if (f.parol_almashtirilsin) redirect("/profil");
  await sahifaTalab(["admin", "ekspert", "kuzatuvchi"]);
  return <DashboardView d={await dashboard()} />;
}
