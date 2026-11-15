import { umumiyKelishuv } from "@/lib/kelishuv";
import { handle } from "@/lib/route";

export const dynamic = "force-dynamic";

export const GET = (req: Request) => {
  const asosiy = new URL(req.url).searchParams.get("asosiy") !== "0";
  return handle(() => umumiyKelishuv(asosiy), 200, ["admin"]);
};
