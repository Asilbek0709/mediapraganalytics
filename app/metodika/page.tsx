import { AiSozlamaKarta } from "@/components/metodika/AiSozlamaKarta";
import { MetodikaView } from "@/components/metodika/MetodikaView";
import { aiHolati } from "@/lib/ai/taklif";
import { STANDART_TARIFLAR } from "@/lib/ai/yoriqnoma";
import { metodikaTarixi, metodikaTolik } from "@/lib/queries";
import { sahifaSarlavhasi } from "@/lib/i18n/server";
import { sahifaTalab } from "@/lib/sessiya";

export const dynamic = "force-dynamic";
export const generateMetadata = () => sahifaSarlavhasi("nav.metodika");

export default async function MetodikaSahifasi() {
  const f = await sahifaTalab(["admin", "ekspert", "kuzatuvchi"]);
  const [met, tarix] = await Promise.all([metodikaTolik(), metodikaTarixi()]);
  // AI sozlamalari (yo‘riqnoma, chegara) — faqat administratorga
  const ai = f.rol === "admin" ? await aiHolati() : null;
  return (
    <div className="flex flex-col gap-5">
      <MetodikaView met={met} tarix={tarix} />
      {ai && <AiSozlamaKarta boshHolat={ai} standartTariflar={STANDART_TARIFLAR} />}
    </div>
  );
}
