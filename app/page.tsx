import { DashboardView } from "@/components/dashboard/DashboardView";
import { dashboard } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export default function BoshPanel() {
  const d = dashboard();
  return <DashboardView d={d} />;
}
