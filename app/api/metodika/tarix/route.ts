import { handle } from "@/lib/route";
import { metodikaTarixi } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const GET = () => handle(() => metodikaTarixi(), 200, ["admin"]);
