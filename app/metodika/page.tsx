import { MetodikaView } from "@/components/metodika/MetodikaView";
import { metodikaTarixi, metodikaTolik } from "@/lib/queries";
import { sahifaSarlavhasi } from "@/lib/i18n/server";
import { sahifaTalab } from "@/lib/sessiya";

export const dynamic = "force-dynamic";
export const generateMetadata = () => sahifaSarlavhasi("nav.metodika");

export default async function MetodikaSahifasi() {
  await sahifaTalab(["admin"]);
  const [met, tarix] = await Promise.all([metodikaTolik(), metodikaTarixi()]);
  return <MetodikaView met={met} tarix={tarix} />;
}
