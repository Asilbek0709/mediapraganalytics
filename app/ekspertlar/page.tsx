import { EkspertlarView } from "@/components/ekspertlar/EkspertlarView";
import { ekspertlarRoyxati, vaznTahlili } from "@/lib/ekspert";
import { umumiyKelishuv } from "@/lib/kelishuv";
import { sahifaSarlavhasi } from "@/lib/i18n/server";
import { sahifaTalab } from "@/lib/sessiya";

export const dynamic = "force-dynamic";
export const generateMetadata = () => sahifaSarlavhasi("nav.ekspertlar");

export default async function EkspertlarSahifasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await sahifaTalab(["admin"]);
  const sp = await searchParams;
  const [ekspertlar, vazn, kelishuv] = await Promise.all([ekspertlarRoyxati(), vaznTahlili(), umumiyKelishuv(sp.asosiy !== "0")]);
  return (
    // Ekspertlar tarkibi o‘zgarsa, vaznlar formasi yangidan to‘ldiriladi
    <EkspertlarView
      key={ekspertlar.map((e) => e.id).join(",")}
      ekspertlar={ekspertlar}
      vazn={vazn}
      kelishuv={kelishuv}
    />
  );
}
