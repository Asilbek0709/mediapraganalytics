import { vaznTahlili } from "@/lib/ekspert";
import { handle } from "@/lib/route";

export const dynamic = "force-dynamic";

export const GET = () => handle(() => vaznTahlili());
