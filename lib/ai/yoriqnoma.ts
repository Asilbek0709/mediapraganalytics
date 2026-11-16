/**
 * AI uchun yo‘riqnoma (ТЗ v2, 4-bo‘lim): III bob mezonlari ta’riflari va javob qoidalari.
 *
 * Ta’riflar matni administrator tomonidan «Metodika → AI yordamchi» da tahrirlanadi (dissertatsiyadagi
 * aniq ta’riflar bilan almashtirish uchun). Prompt versiyasi matnning xeshidan olinadi — har bir taklif
 * qaysi yo‘riqnoma bilan olingani saqlanadi (takrorlanuvchanlik).
 */

export interface Variant {
  kod: string;
  nomi: string;
}

export interface AiMetodika {
  sarlavhaTurlari: Variant[];
  muvofiqlik: Variant[];
  kompozitsiya: Variant[];
  kategoriyalar: (Variant & { guruh: "muammo" | "vosita" })[];
}

/** Boshlang‘ich ta’riflar — tadqiqotchi III bobdagi ta’riflar bilan almashtirishi tavsiya etiladi */
export const STANDART_TARIFLAR = `SARLAVHA TURLARI (bir nechtasi bo‘lishi mumkin)
- axborotiy — voqea haqida neytral, faktik xabar beradi (kim, nima, qayerda, qachon).
- baholovchi — muallifning bahosi yoki munosabati ifodalangan (ijobiy yoki salbiy baho so‘zlari).
- emotsional — his-hayajon uyg‘otishga qaratilgan (undov, hissiy leksika, kuchaytiruvchi vositalar).
- savol — savol shaklida tuzilgan.
- chaqiriqli — o‘quvchini harakatga yoki munosabat bildirishga undaydi.
- metaforik — ko‘chma ma’no, metafora, o‘xshatish yoki iboraga asoslangan.
- abstrakt — umumiy va mavhum, matnning aniq mazmunini bermaydi.
- pragmatik_nomutanosib — sarlavha matn mazmuniga yoki kommunikativ maqsadiga mos emas (chalg‘ituvchi, bo‘rttirilgan).

SEMANTIK-PRAGMATIK MUVOFIQLIK (sarlavha–lid, lid–asosiy matn, sarlavha–asosiy matn)
- mos — mazmun va kommunikativ maqsad to‘liq mos keladi.
- qisman — asosiy mazmun mos, lekin ayrim muhim jihatlar aks etmagan yoki urg‘u boshqa.
- mos_emas — mazmun yoki maqsad mos kelmaydi.

KOMPOZITSIYA
- mantiqiy — axborot ahamiyatiga ko‘ra tartiblangan, qismlar mantiqan bog‘langan.
- ketma_ket — voqealar xronologik yoki izchil tartibda bayon qilingan.
- aralash — tartiblashning bir necha usuli aralashgan.
- buzilgan — axborot ierarxiyasi buzilgan: asosiy fakt yashirin yoki tartibsiz joylashgan.

LINGVOPRAGMATIK ANIQLIK — matndagi aniq birliklar (har biri matndan so‘zma-so‘z olinadi)
Muammolar:
- abstrakt_jumla — aniq fakt yoki ma’lumot bermaydigan umumiy, mavhum jumla.
- semantik_noaniqlik — so‘z yoki ibora ma’nosi noaniq, ko‘p ma’noli yoki mazmunni xiralashtiradi.
- referensial_noaniqlik — kim yoki nima nazarda tutilgani aniq emas (masalan, «mutasaddilar», «ular» kim ekani ko‘rsatilmagan).
- mantiqiy_noaniqlik — mantiqiy bog‘lanish buzilgan, sabab-oqibat noaniq yoki ziddiyat bor.
- interpretativ_noaniqlik — bayon turlicha talqin qilinishi mumkin.
- uslubiy_xatolik — grammatik, leksik yoki uslubiy me’yor buzilishi.
- kontekstual_nomuvofiqlik — birlik auditoriya yoki vaziyat kontekstiga mos emas (izohsiz atama, nomuvofiq uslub).
Pragmatik vositalar:
- baholovchi_birlik — muallif bahosini ifodalovchi so‘z yoki ibora.
- modal_birlik — ehtimollik, zarurat, ishonch kabi modallikni ifodalovchi birlik (balki, albatta, kerak).
- murojaat — o‘quvchiga to‘g‘ridan-to‘g‘ri murojaat.
- chaqiriq — o‘quvchini harakatga undash.`;

const royxat = (v: Variant[]) => v.map((x) => `${x.kod} — ${x.nomi}`).join("\n");

/** Tizim prompti: rol, qoidalar, kodlar ro‘yxati va ta’riflar */
export function promptYasash(m: AiMetodika, tariflar: string): string {
  return `Siz o‘zbek tilidagi mediamatnlarni lingvopragmatik tahlil qilishda tadqiqotchiga yordam beruvchi annotatorsiz. Tahlil dissertatsiyaning III bobidagi mezonlar asosida olib boriladi.

QOIDALAR
1. Siz faqat TAKLIF berasiz: yakuniy qarorni tadqiqotchi qabul qiladi.
2. Matn yaratmang va o‘zgartirmang. Har bir belgi uchun «fragment» — tegishli qismdan (sarlavha, lid yoki asosiy matn) so‘zma-so‘z, harfma-harf ko‘chirilgan bo‘lak; odatda bitta jumla yoki uning bir qismi.
3. Faqat quyida berilgan kodlardan foydalaning.
4. Har bir taklifga bitta jumlali asos yozing (o‘zbek tilida, lotin yozuvida) va ishonch darajasini belgilang: past, orta yoki yuqori.
5. Shubhali holatda ishonch darajasini past qiling; aniq dalil bo‘lmasa, belgi qo‘shmang.
6. Lid yo‘q bo‘lsa, lid bilan bog‘liq muvofiqlik qiymati — null.

KODLAR
Sarlavha turlari:
${royxat(m.sarlavhaTurlari)}

Muvofiqlik:
${royxat(m.muvofiqlik)}

Kompozitsiya:
${royxat(m.kompozitsiya)}

Belgi kategoriyalari:
${m.kategoriyalar.map((k) => `${k.kod} — ${k.nomi} (${k.guruh === "muammo" ? "muammo" : "pragmatik vosita"})`).join("\n")}

TA’RIFLAR
${tariflar.trim()}`;
}

/** Tahlil qilinadigan material — foydalanuvchi xabari */
export function materialXabari(m: { sarlavha: string; lid: string | null; matn: string | null; nashr?: string; sana?: string | null; janr?: string | null }): string {
  const meta = [m.nashr && `Nashr: ${m.nashr}`, m.sana && `Sana: ${m.sana}`, m.janr && `Janr: ${m.janr}`].filter(Boolean).join("; ");
  return `${meta ? `${meta}\n\n` : ""}<sarlavha>
${m.sarlavha}
</sarlavha>

<lid>
${m.lid ?? ""}
</lid>

<asosiy_matn>
${m.matn ?? ""}
</asosiy_matn>

Ushbu materialni yuqoridagi mezonlar bo‘yicha tahlil qiling va takliflaringizni berilgan sxemada qaytaring.`;
}
