import { MediabazaView } from "@/components/mediabaza/MediabazaView";
import { janrlar, materiallarRoyxati, nashrlarRoyxati } from "@/lib/queries";
import { metodikaniYuklash } from "@/lib/scoring";
import type { Holat } from "@/lib/types";
import { sahifaSarlavhasi } from "@/lib/i18n/server";

const HOLATLAR: Holat[] = ["tahlil_qilingan", "toliq_emas", "tahlil_qilinmagan"];

export const dynamic = "force-dynamic";
export const generateMetadata = () => sahifaSarlavhasi("nav.mediabaza");

export default async function MediabazaSahifasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const holat = HOLATLAR.find((h) => h === sp.holat);

  return (
    <MediabazaView
      boshlangich={materiallarRoyxati({ holat })}
      nashrlar={nashrlarRoyxati()}
      janrlar={janrlar()}
      shkala={metodikaniYuklash().shkala}
      yangiOchiq={sp.yangi !== undefined}
      boshlangichHolat={holat ?? ""}
    />
  );
}
