import { notFound, redirect } from "next/navigation";

import { TahlilView, type Baholovchi } from "@/components/tahlil/TahlilView";
import { ekspertTahlilOlish, materialBaholovchilari } from "@/lib/ekspert";
import { idRaqami } from "@/lib/format";
import { sahifaSarlavhasi } from "@/lib/i18n/server";
import { metodikaTolik, tahlilOlish } from "@/lib/queries";
import { sahifaTalab } from "@/lib/sessiya";

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
  const f = await sahifaTalab(["admin", "ekspert"]);
  const { id } = await params;
  const sp = await searchParams;
  const materialId = Number(id);
  if (!Number.isInteger(materialId) || materialId <= 0) notFound();

  const ekspertParam = Array.isArray(sp.ekspert) ? sp.ekspert[0] : sp.ekspert;
  // Ekspert faqat o‘z qatlamini ochadi (manzildagi parametrga qaramay); bog‘lanmagan bo‘lsa — vazifalar sahifasi
  if (f.rol === "ekspert" && !f.ekspert_id) redirect("/vazifalar");
  const ekspertId = f.rol === "ekspert" ? f.ekspert_id : ekspertParam ? Number(ekspertParam) : null;

  let data: Awaited<ReturnType<typeof tahlilOlish>>;
  let baholovchi: Baholovchi = { tur: "asosiy" };
  try {
    if (ekspertId && Number.isInteger(ekspertId) && ekspertId > 0) {
      const e = await ekspertTahlilOlish(materialId, ekspertId);
      data = { material: e.material, tahlil: e.tahlil, belgilar: e.belgilar, natija: e.natija };
      baholovchi = { tur: "ekspert", id: e.ekspert.id, ism: e.ekspert.ism };
    } else {
      data = await tahlilOlish(materialId);
    }
  } catch {
    notFound();
  }

  const [met, baholovchilar] = await Promise.all([
    metodikaTolik(),
    f.rol === "admin" ? materialBaholovchilari(materialId) : Promise.resolve(undefined),
  ]);
  return (
    <TahlilView
      key={baholovchi.tur === "ekspert" ? `e${baholovchi.id}` : "asosiy"}
      material={data.material}
      tahlil={data.tahlil}
      belgilar={data.belgilar}
      natija={data.natija}
      met={met}
      baholovchi={baholovchi}
      baholovchilar={baholovchilar}
      qaytish={f.rol === "ekspert" ? { href: "/vazifalar", kalit: "nav.vazifalar" } : undefined}
    />
  );
}
