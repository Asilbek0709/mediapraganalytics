import { ImportView } from "@/components/mediabaza/ImportView";
import { sahifaSarlavhasi } from "@/lib/i18n/server";
import { sahifaTalab } from "@/lib/sessiya";

export const dynamic = "force-dynamic";

export const generateMetadata = () => sahifaSarlavhasi("nav.import");

export default async function ImportSahifasi() {
  await sahifaTalab(["admin"]);
  return <ImportView />;
}
