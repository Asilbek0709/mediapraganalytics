import { AiMoslikKarta } from "@/components/analitika/AiMoslikKarta";
import { AnalitikaView } from "@/components/analitika/AnalitikaView";
import { aiMoslik } from "@/lib/ai/taklif";
import { analitika, filtrniTekshirish } from "@/lib/analitika";
import { all, hisobgaShart } from "@/lib/db";
import { sahifaSarlavhasi } from "@/lib/i18n/server";
import { sahifaTalab } from "@/lib/sessiya";

export const dynamic = "force-dynamic";
export const generateMetadata = () => sahifaSarlavhasi("nav.analitika");

export default async function AnalitikaSahifasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await sahifaTalab(["admin", "ekspert", "kuzatuvchi"]);
  const filtr = filtrniTekshirish(await searchParams);
  const [a, moslik, kategoriyalar] = await Promise.all([
    analitika(filtr),
    aiMoslik(hisobgaShart("m")),
    all<{ kod: string; nomi: string }>("SELECT kod, nomi FROM kategoriyalar"),
  ]);
  return (
    <div className="flex flex-col gap-5">
      {/* Filtr o‘zgarganda ko‘rinish qayta tug‘iladi va animatsiyalar yangidan ijro etiladi */}
      <AnalitikaView key={JSON.stringify(filtr)} a={a} />
      <AiMoslikKarta m={moslik} kategoriyaNomlari={Object.fromEntries(kategoriyalar.map((k) => [k.kod, k.nomi]))} />
    </div>
  );
}
