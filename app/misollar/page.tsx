import { MisollarView } from "@/components/misollar/MisollarView";
import { sahifaSarlavhasi } from "@/lib/i18n/server";
import { misolFiltriniOqish, misolFiltriQatori } from "@/lib/misollar";
import { misollarKorpusi } from "@/lib/misollarBaza";
import { sahifaTalab } from "@/lib/sessiya";

export const dynamic = "force-dynamic";
export const generateMetadata = () => sahifaSarlavhasi("ms.sarlavha");

export default async function MisollarSahifasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await sahifaTalab(["admin", "kuzatuvchi"]);
  const filtr = misolFiltriniOqish(await searchParams);
  // Havola orqali boshqa filtr bilan kelinganda ko‘rinish shu filtrdan qayta boshlanadi
  return <MisollarView key={misolFiltriQatori(filtr)} korpus={await misollarKorpusi()} boshFiltr={filtr} />;
}
