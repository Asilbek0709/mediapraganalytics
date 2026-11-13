import { notFound } from "next/navigation";

import { TahlilView, type Baholovchi } from "@/components/tahlil/TahlilView";
import { ekspertTahlilOlish, materialBaholovchilari } from "@/lib/ekspert";
import { idRaqami } from "@/lib/format";
import { sahifaSarlavhasi } from "@/lib/i18n/server";
import { metodikaTolik, tahlilOlish } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return sahifaSarlavhasi("nav.tahlil", idRaqami(id));
}

export default async function TahlilSahifasi({
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

  const ekspertParam = Array.isArray(sp.ekspert) ? sp.ekspert[0] : sp.ekspert;
  const ekspertId = ekspertParam ? Number(ekspertParam) : null;

  let data: ReturnType<typeof tahlilOlish>;
  let baholovchi: Baholovchi = { tur: "asosiy" };
  try {
    if (ekspertId && Number.isInteger(ekspertId) && ekspertId > 0) {
      const e = ekspertTahlilOlish(materialId, ekspertId);
      data = { material: e.material, tahlil: e.tahlil, belgilar: e.belgilar, natija: e.natija };
      baholovchi = { tur: "ekspert", id: e.ekspert.id, ism: e.ekspert.ism };
    } else {
      data = tahlilOlish(materialId);
    }
  } catch {
    notFound();
  }

  return (
    <TahlilView
      key={baholovchi.tur === "ekspert" ? `e${baholovchi.id}` : "asosiy"}
      material={data.material}
      tahlil={data.tahlil}
      belgilar={data.belgilar}
      natija={data.natija}
      met={metodikaTolik()}
      baholovchi={baholovchi}
      baholovchilar={materialBaholovchilari(materialId)}
    />
  );
}
