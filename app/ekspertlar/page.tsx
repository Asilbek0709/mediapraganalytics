import { EkspertlarView } from "@/components/ekspertlar/EkspertlarView";
import { ekspertlarRoyxati, vaznTahlili } from "@/lib/ekspert";
import { umumiyKelishuv } from "@/lib/kelishuv";
import { sahifaSarlavhasi } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const generateMetadata = () => sahifaSarlavhasi("nav.ekspertlar");

export default async function EkspertlarSahifasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ekspertlar = ekspertlarRoyxati();
  return (
    // Ekspertlar tarkibi o‘zgarsa, vaznlar formasi yangidan to‘ldiriladi
    <EkspertlarView
      key={ekspertlar.map((e) => e.id).join(",")}
      ekspertlar={ekspertlar}
      vazn={vaznTahlili()}
      kelishuv={umumiyKelishuv(sp.asosiy !== "0")}
    />
  );
}
