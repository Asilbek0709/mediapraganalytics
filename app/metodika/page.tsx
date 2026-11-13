import { MetodikaView } from "@/components/metodika/MetodikaView";
import { metodikaTarixi, metodikaTolik } from "@/lib/queries";
import { sahifaSarlavhasi } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const generateMetadata = () => sahifaSarlavhasi("nav.metodika");

export default function MetodikaSahifasi() {
  return <MetodikaView met={metodikaTolik()} tarix={metodikaTarixi()} />;
}
