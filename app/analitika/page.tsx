import { AnalitikaView } from "@/components/analitika/AnalitikaView";
import { analitika, filtrniTekshirish } from "@/lib/analitika";
import { sahifaSarlavhasi } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const generateMetadata = () => sahifaSarlavhasi("nav.analitika");

export default async function AnalitikaSahifasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filtr = filtrniTekshirish(await searchParams);
  const a = analitika(filtr);
  // Filtr o‘zgarganda ko‘rinish qayta tug‘iladi va animatsiyalar yangidan ijro etiladi
  return <AnalitikaView key={JSON.stringify(filtr)} a={a} />;
}
