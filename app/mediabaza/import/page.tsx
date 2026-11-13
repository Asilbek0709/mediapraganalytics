import { ImportView } from "@/components/mediabaza/ImportView";
import { sahifaSarlavhasi } from "@/lib/i18n/server";

export const generateMetadata = () => sahifaSarlavhasi("nav.import");

export default function ImportSahifasi() {
  return <ImportView />;
}
