import { notFound } from "next/navigation";

import { KelishuvView } from "@/components/ekspertlar/KelishuvView";
import { idRaqami } from "@/lib/format";
import { sahifaSarlavhasi } from "@/lib/i18n/server";
import { materialKelishuvi } from "@/lib/kelishuv";
import { metodikaniYuklash } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return sahifaSarlavhasi("nav.kelishuv", idRaqami(id));
}

export default async function KelishuvSahifasi({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const materialId = Number(id);
  if (!Number.isInteger(materialId) || materialId <= 0) notFound();

  let k: ReturnType<typeof materialKelishuvi>;
  try {
    k = materialKelishuvi(materialId, sp.asosiy !== "0");
  } catch {
    notFound();
  }
  return <KelishuvView k={k} shkala={metodikaniYuklash().shkala} />;
}
