import { DashboardView } from "@/components/dashboard/DashboardView";
import { dashboard } from "@/lib/analytics";
import { sahifaTalab } from "@/lib/sessiya";

export const dynamic = "force-dynamic";

export default async function BoshPanel() {
  await sahifaTalab(["admin", "kuzatuvchi"]);
  const d = await dashboard();
  return <DashboardView d={d} />;
}
