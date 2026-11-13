import { handle } from "@/lib/route";
import { dashboard } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export const GET = () => handle(() => dashboard());
