import { MediabazaView } from "@/components/mediabaza/MediabazaView";
import { janrlar, materiallarRoyxati, nashrlarRoyxati } from "@/lib/queries";
import { metodikaniYuklash } from "@/lib/scoring";
import type { Holat } from "@/lib/types";
import { sahifaSarlavhasi } from "@/lib/i18n/server";
import { sahifaTalab } from "@/lib/sessiya";

const HOLATLAR: Holat[] = ["tahlil_qilingan", "toliq_emas", "tahlil_qilinmagan"];

export const dynamic = "force-dynamic";
export const generateMetadata = () => sahifaSarlavhasi("nav.mediabaza");

export default async function MediabazaSahifasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const f = await sahifaTalab(["admin", "ekspert"]);
  const sp = await searchParams;
  const holat = HOLATLAR.find((h) => h === sp.holat);

  const [boshlangich, nashrlar, janrRoyxati, m] = await Promise.all([
    materiallarRoyxati({ holat }),
    nashrlarRoyxati(),
    janrlar(),
    metodikaniYuklash(),
  ]);
  return (
    <MediabazaView
      boshlangich={boshlangich}
      nashrlar={nashrlar}
      janrlar={janrRoyxati}
      shkala={m.shkala}
      yangiOchiq={f.rol === "admin" && sp.yangi !== undefined}
      boshlangichHolat={holat ?? ""}
    />
  );
}
