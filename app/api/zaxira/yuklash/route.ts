import { handle } from "@/lib/route";
import { zaxiraniYuklash } from "@/lib/zaxira";

export const dynamic = "force-dynamic";

/** Kompyuterdan tanlangan nusxani (.json.gz yoki eski SQLite .db) tekshirib, ro‘yxatga qo‘shadi (multipart: «fayl»). Bazaga hali tegmaydi. */
export const POST = (req: Request) =>
  handle(async () => {
    const forma = await req.formData();
    const fayl = forma.get("fayl");
    return zaxiraniYuklash(fayl instanceof File ? fayl : null);
  }, 201, ["admin"]);
