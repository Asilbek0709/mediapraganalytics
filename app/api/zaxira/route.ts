import { handle } from "@/lib/route";
import { zaxiraHolati, zaxiraYaratish } from "@/lib/zaxira";

export const dynamic = "force-dynamic";

/** Joriy baza va zaxira nusxalar ro‘yxati */
export const GET = () => handle(zaxiraHolati);

/** Qo‘lda zaxira yaratish */
export const POST = () => handle(zaxiraYaratish, 201);
