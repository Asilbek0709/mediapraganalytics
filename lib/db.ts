/**
 * Ma’lumotlar bazasi — PostgreSQL.
 *
 *  - DATABASE_URL berilsa (postgres://…) — tashqi server, masalan Supabase (Vercel’da shu yo‘l).
 *    Lekin MEDIAPRAG_DB aniq berilgan bo‘lsa (demo, testlar) — doim PGlite.
 *    Supabase pooler’ining tranzaksiya rejimi uchun tayyorlangan so‘rovlar o‘chirilgan (prepare: false).
 *  - Aks holda — PGlite (WebAssembly’dagi to‘liq PostgreSQL): kompyuterdagi papkada, internetsiz.
 *    Papka: MEDIAPRAG_DB (standart — data/pglite); «memory://» — xotirada (testlar uchun).
 *
 * Ikkala holatda SQL bir xil. So‘rovlarda «?» belgilari ishlatiladi — ular avtomatik $1, $2 … ga o‘giriladi.
 * transaction() ichidagi barcha all/one/run chaqiruvlari o‘z-o‘zidan shu tranzaksiyada bajariladi.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";

import { heshUchunMatn } from "./manba.ts";
import { KATEGORIYALAR, LUGAT, MEZONLAR, NASHRLAR, SHKALA } from "./seed.ts";

/**
 * Sxema migratsiyalari (Alembic o‘rnida): SCHEMA — 2-versiyadagi asos, undan keyingi har bir o‘zgarish —
 * raqamlangan migratsiya. Baza qaysi versiyada ekani sozlamalar.sxema_versiya da, qo‘llangan migratsiyalar
 * jurnali — migratsiyalar jadvalida. Yangi o‘zgarish: MIGRATSIYALAR ga keyingi raqam bilan qo‘shiladi.
 */
interface Migratsiya {
  versiya: number;
  nomi: string;
  bajar: (u: Ulanish) => Promise<void>;
}

/** Matn xeshi (takroriy materialni topish uchun) — SHA-256 */
export function matnHeshi(m: { sarlavha?: string | null; lid?: string | null; matn?: string | null }): string | null {
  const t = heshUchunMatn(m);
  return t ? createHash("sha256").update(t).digest("hex") : null;
}

/** Xeshi yo‘q materiallarga xesh yozish (migratsiyadan va eski nusxani tiklashdan keyin) */
export async function heshlarniToldirish(u: Ulanish): Promise<void> {
  const r = await u.sorov("SELECT id, sarlavha, lid, matn FROM materiallar WHERE matn_hash IS NULL", []);
  for (const q of r.rows) {
    await u.sorov("UPDATE materiallar SET matn_hash = $1 WHERE id = $2", [
      matnHeshi(q as { sarlavha: string; lid: string; matn: string }),
      q.id,
    ]);
  }
}

const MIGRATSIYALAR: Migratsiya[] = [
  {
    versiya: 3,
    nomi: "Material manbasi, tekshiruv belgisi, matn xeshi, manba arxivi; metodika tarixida muallif",
    bajar: async (u) => {
      await u.bajar(`
        ALTER TABLE materiallar ADD COLUMN IF NOT EXISTS manba_turi text NOT NULL DEFAULT 'qolda';
        ALTER TABLE materiallar ADD COLUMN IF NOT EXISTS olingan_sana text;
        ALTER TABLE materiallar ADD COLUMN IF NOT EXISTS matn_hash text;
        ALTER TABLE materiallar ADD COLUMN IF NOT EXISTS tekshirilgan boolean NOT NULL DEFAULT true;
        DO $$ BEGIN
          ALTER TABLE materiallar ADD CONSTRAINT materiallar_manba_turi_check
            CHECK (manba_turi IN ('qolda', 'havola', 'pdf', 'ocr', 'import', 'suniy'));
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
        CREATE INDEX IF NOT EXISTS idx_materiallar_hash ON materiallar(matn_hash);

        -- asl HTML (siqilgan) — alohida jadvalda: zaxira nusxalarga kirmaydi, aks holda ular juda kattalashadi
        CREATE TABLE IF NOT EXISTS manba_arxivi (
            material_id  integer PRIMARY KEY,
            url          text,
            olingan_sana text NOT NULL,
            -- material yaratilgan vaqt: nusxadan tiklangach arxiv aynan shu materialnikimi — shu bilan tekshiriladi
            material_yaratilgan text NOT NULL,
            html         bytea NOT NULL,
            hajm         integer NOT NULL
        );

        ALTER TABLE metodika_tarixi ADD COLUMN IF NOT EXISTS muallif text;

        CREATE TABLE IF NOT EXISTS migratsiyalar (
            versiya   integer PRIMARY KEY,
            nomi      text NOT NULL,
            qollangan text NOT NULL
        );

        -- avval yaratilgan namuna (demo) materiallari — sun’iy
        UPDATE materiallar SET manba_turi = 'suniy' WHERE manba_turi = 'qolda' AND sarlavha LIKE '[DEMO]%';
      `);
      await heshlarniToldirish(u);
    },
  },
  {
    versiya: 4,
    nomi: "AI takliflari va tadqiqotchi qarori; belgilar holati (qo‘lda / AI tasdiqlangan / AI o‘zgartirilgan)",
    bajar: async (u) => {
      await u.bajar(`
        ALTER TABLE belgilar ADD COLUMN IF NOT EXISTS holat text NOT NULL DEFAULT 'qolda';
        ALTER TABLE belgilar ADD COLUMN IF NOT EXISTS tasdiqlagan text;
        ALTER TABLE belgilar ADD COLUMN IF NOT EXISTS tasdiq_sanasi text;
        DO $$ BEGIN
          ALTER TABLE belgilar ADD CONSTRAINT belgilar_holat_check
            CHECK (holat IN ('qolda', 'ai_tasdiqlangan', 'ai_ozgartirilgan'));
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        -- takrorlanuvchanlik: har bir taklif qaysi prompt bilan olingani
        CREATE TABLE IF NOT EXISTS ai_promptlar (
            versiya    text PRIMARY KEY,
            matn       text NOT NULL,
            yaratilgan text NOT NULL
        );

        -- har bir so‘rov: kim, qachon, qaysi model, nechta token (kunlik chegara va xarajat uchun)
        CREATE TABLE IF NOT EXISTS ai_sorovlar (
            id             integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            material_id    integer,
            foydalanuvchi  text,
            model          text,
            prompt_versiya text,
            vaqt           text NOT NULL,
            kirish_token   integer,
            chiqish_token  integer,
            holat          text NOT NULL,
            xato           text
        );

        -- AI taklifi va tadqiqotchining yakuniy qarori alohida (AI–tadqiqotchi mosligi uchun)
        CREATE TABLE IF NOT EXISTS ai_takliflar (
            id              integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            sorov_id        integer,
            material_id     integer NOT NULL REFERENCES materiallar(id) ON DELETE CASCADE,
            blok            text NOT NULL,
            taklif_qiymati  text NOT NULL,
            asos            text,
            ishonch         text,
            model           text NOT NULL,
            prompt_versiya  text NOT NULL,
            yakuniy_qaror   text CHECK (yakuniy_qaror IN ('tasdiqlangan', 'ozgartirilgan', 'rad')),
            yakuniy_qiymat  text,
            qaror_beruvchi  text,
            qaror_sanasi    text,
            yaratilgan_sana text NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_ai_takliflar_material ON ai_takliflar(material_id);
        CREATE INDEX IF NOT EXISTS idx_ai_sorovlar_vaqt ON ai_sorovlar(vaqt);
      `);
    },
  },
  {
    versiya: 5,
    nomi: "Ochiq ro‘yxatdan o‘tish: o‘zi ro‘yxatdan o‘tgan hisoblar belgisi",
    bajar: async (u) => {
      await u.bajar(`
        ALTER TABLE foydalanuvchilar ADD COLUMN IF NOT EXISTS ozi_royxatdan boolean NOT NULL DEFAULT false;
        CREATE INDEX IF NOT EXISTS idx_foydalanuvchilar_yaratilgan ON foydalanuvchilar(yaratilgan);
      `);
    },
  },
  {
    versiya: 6,
    nomi: "Demo rejimi: parolsiz kiriladigan umumiy «faqat ko‘rish» hisobi belgisi",
    bajar: async (u) => {
      await u.bajar(`
        ALTER TABLE foydalanuvchilar ADD COLUMN IF NOT EXISTS demo boolean NOT NULL DEFAULT false;
      `);
    },
  },
];

/** Joriy sxema versiyasi — oxirgi migratsiya */
export const SXEMA_VERSIYASI = Math.max(2, ...MIGRATSIYALAR.map((m) => m.versiya));

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS nashrlar (
    id    integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    nomi  text NOT NULL UNIQUE,
    turi  text NOT NULL CHECK (turi IN ('bosma', 'raqamli'))
);

CREATE TABLE IF NOT EXISTS materiallar (
    id          integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    nashr_id    integer NOT NULL REFERENCES nashrlar(id),
    sana        text,
    janr        text,
    mavzu       text,
    havola      text,
    sarlavha    text NOT NULL,
    lid         text,
    matn        text,
    yaratilgan  text NOT NULL,
    yangilangan text NOT NULL
);

CREATE TABLE IF NOT EXISTS tahlillar (
    material_id      integer PRIMARY KEY REFERENCES materiallar(id) ON DELETE CASCADE,
    sarlavha_turlari text NOT NULL DEFAULT '[]',
    kompozitsiya     text,
    sar_lid          text,
    lid_matn         text,
    sar_matn         text,
    auditoriya       integer CHECK (auditoriya BETWEEN 1 AND 5),
    izoh             text,
    k1 double precision, k2 double precision, k3 double precision, k4 double precision, k5 double precision,
    lpsi             double precision,
    daraja           text,
    metodika_versiya integer,
    yangilangan      text NOT NULL
);

CREATE TABLE IF NOT EXISTS kategoriyalar (
    kod    text PRIMARY KEY,
    nomi   text NOT NULL,
    guruh  text NOT NULL CHECK (guruh IN ('muammo', 'vosita')),
    mezon  text,
    jarima double precision NOT NULL DEFAULT 0,
    tartib integer NOT NULL
);

CREATE TABLE IF NOT EXISTS belgilar (
    id          integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    material_id integer NOT NULL REFERENCES materiallar(id) ON DELETE CASCADE,
    kategoriya  text NOT NULL REFERENCES kategoriyalar(kod),
    qism        text NOT NULL CHECK (qism IN ('sarlavha', 'lid', 'matn')),
    fragment    text,
    izoh        text
);

CREATE TABLE IF NOT EXISTS lugat (
    turkum text NOT NULL,
    kod    text NOT NULL,
    nomi   text NOT NULL,
    qiymat double precision,
    tartib integer NOT NULL,
    PRIMARY KEY (turkum, kod)
);

CREATE TABLE IF NOT EXISTS mezonlar (
    kod    text PRIMARY KEY,
    nomi   text NOT NULL,
    vazn   double precision NOT NULL,
    tavsif text
);

CREATE TABLE IF NOT EXISTS sozlamalar (
    kalit  text PRIMARY KEY,
    qiymat text NOT NULL
);

CREATE TABLE IF NOT EXISTS metodika_tarixi (
    versiya  integer PRIMARY KEY,
    sana     text NOT NULL,
    izoh     text,
    snapshot text NOT NULL
);

-- ekspertlar, ularning mustaqil tahlillari va vaznlar bo‘yicha so‘rov
CREATE TABLE IF NOT EXISTS ekspertlar (
    id         integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    ism        text NOT NULL UNIQUE,
    izoh       text,
    yaratilgan text NOT NULL
);

CREATE TABLE IF NOT EXISTS ekspert_tahlillari (
    id               integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    material_id      integer NOT NULL REFERENCES materiallar(id) ON DELETE CASCADE,
    ekspert_id       integer NOT NULL REFERENCES ekspertlar(id) ON DELETE CASCADE,
    sarlavha_turlari text NOT NULL DEFAULT '[]',
    kompozitsiya     text,
    sar_lid          text,
    lid_matn         text,
    sar_matn         text,
    auditoriya       integer CHECK (auditoriya BETWEEN 1 AND 5),
    izoh             text,
    k1 double precision, k2 double precision, k3 double precision, k4 double precision, k5 double precision,
    lpsi             double precision,
    daraja           text,
    metodika_versiya integer,
    yangilangan      text NOT NULL,
    UNIQUE (material_id, ekspert_id)
);

CREATE TABLE IF NOT EXISTS ekspert_belgilari (
    id                integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    ekspert_tahlil_id integer NOT NULL REFERENCES ekspert_tahlillari(id) ON DELETE CASCADE,
    kategoriya        text NOT NULL REFERENCES kategoriyalar(kod),
    qism              text NOT NULL CHECK (qism IN ('sarlavha', 'lid', 'matn')),
    fragment          text,
    izoh              text
);

CREATE TABLE IF NOT EXISTS ekspert_vaznlari (
    ekspert_id  integer PRIMARY KEY REFERENCES ekspertlar(id) ON DELETE CASCADE,
    k1 double precision NOT NULL, k2 double precision NOT NULL, k3 double precision NOT NULL,
    k4 double precision NOT NULL, k5 double precision NOT NULL,
    izoh        text,
    yangilangan text NOT NULL
);

-- misollar korpusidagi ★ tanlovlar (belgi id’siga emas, fragmentga bog‘lanadi)
CREATE TABLE IF NOT EXISTS tanlangan_misollar (
    material_id integer NOT NULL REFERENCES materiallar(id) ON DELETE CASCADE,
    kategoriya  text NOT NULL,
    qism        text NOT NULL,
    fragment    text NOT NULL,
    yaratilgan  text NOT NULL,
    PRIMARY KEY (material_id, kategoriya, qism, fragment)
);

-- foydalanuvchilar va kirish
CREATE TABLE IF NOT EXISTS foydalanuvchilar (
    id          integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    email       text NOT NULL UNIQUE,
    ism         text NOT NULL,
    rol         text NOT NULL CHECK (rol IN ('admin', 'ekspert', 'kuzatuvchi')),
    parol_hash  text NOT NULL,
    ekspert_id  integer UNIQUE REFERENCES ekspertlar(id) ON DELETE SET NULL,
    faol        boolean NOT NULL DEFAULT true,
    parol_almashtirilsin boolean NOT NULL DEFAULT true,
    yaratilgan  text NOT NULL,
    oxirgi_kirish text
);

CREATE TABLE IF NOT EXISTS sessiyalar (
    id              text PRIMARY KEY,
    foydalanuvchi_id integer NOT NULL REFERENCES foydalanuvchilar(id) ON DELETE CASCADE,
    yaratilgan      text NOT NULL,
    muddat          text NOT NULL
);

CREATE TABLE IF NOT EXISTS kirish_urinishlari (
    id     integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    email  text NOT NULL,
    vaqt   text NOT NULL,
    muvaffaqiyat boolean NOT NULL
);

-- zaxira nusxalar (siqilgan JSON) — bazaning o‘zida: Vercel’da doimiy disk yo‘q
CREATE TABLE IF NOT EXISTS zaxiralar (
    id         integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    nom        text NOT NULL UNIQUE,
    tur        text NOT NULL CHECK (tur IN ('qolda', 'avto', 'tiklashdan_oldin', 'yuklangan')),
    yaratilgan text NOT NULL,
    hajm       integer NOT NULL,
    statistika text NOT NULL,
    malumot    bytea NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ekspert_tahlil_material ON ekspert_tahlillari(material_id);
CREATE INDEX IF NOT EXISTS idx_ekspert_belgi_tahlil ON ekspert_belgilari(ekspert_tahlil_id);
CREATE INDEX IF NOT EXISTS idx_materiallar_nashr ON materiallar(nashr_id);
CREATE INDEX IF NOT EXISTS idx_belgilar_material ON belgilar(material_id);
CREATE INDEX IF NOT EXISTS idx_sessiyalar_foydalanuvchi ON sessiyalar(foydalanuvchi_id);
CREATE INDEX IF NOT EXISTS idx_kirish_urinishlari ON kirish_urinishlari(email, vaqt);
`;

/** Ma’lumotlar jadvallari — zaxira va ko‘chirish shu tartibda (tashqi kalitlar bo‘yicha) ishlaydi. */
export const JADVALLAR = [
  "nashrlar",
  "kategoriyalar",
  "lugat",
  "mezonlar",
  "sozlamalar",
  "metodika_tarixi",
  "materiallar",
  "tahlillar",
  "belgilar",
  "ekspertlar",
  "ekspert_tahlillari",
  "ekspert_belgilari",
  "ekspert_vaznlari",
  "tanlangan_misollar",
  "ai_promptlar",
  "ai_sorovlar",
  "ai_takliflar",
] as const;

/** Vaqt zonasi: server UTC’da ishlasa ham (Vercel) vaqt tadqiqotchinikidek yoziladi. */
const VAQT_ZONASI = process.env.MEDIAPRAG_TZ || "Asia/Tashkent";
const vaqtFormati = new Intl.DateTimeFormat("en-CA", {
  timeZone: VAQT_ZONASI,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function hozir(d = new Date()): string {
  const q = Object.fromEntries(vaqtFormati.formatToParts(d).map((p) => [p.type, p.value]));
  return `${q.year}-${q.month}-${q.day}T${q.hour}:${q.minute}:${q.second}`;
}

// ------------------------------------------------------------------ ulanish

type Qator = Record<string, unknown>;
export interface Ulanish {
  sorov(sql: string, params: unknown[]): Promise<{ rows: Qator[]; soni: number }>;
  /** parametrsiz bir nechta buyruq (sxema) */
  bajar(sql: string): Promise<void>;
  tranzaksiya<T>(fn: (u: Ulanish) => Promise<T>): Promise<T>;
  yopish(): Promise<void>;
  tur: "postgres" | "pglite";
}

/** «?» → $1, $2 …; qo‘shtirnoq ichidagi matnga tegilmaydi. */
export function parametrlar(sql: string): string {
  let n = 0;
  let natija = "";
  let qotirnoq: string | null = null;
  for (const c of sql) {
    if (qotirnoq) {
      if (c === qotirnoq) qotirnoq = null;
      natija += c;
    } else if (c === "'" || c === '"') {
      qotirnoq = c;
      natija += c;
    } else if (c === "?") natija += `$${++n}`;
    else natija += c;
  }
  return natija;
}

const songa = (x: string) => Number(x);

async function postgresUlanish(url: string): Promise<Ulanish> {
  const { default: postgres } = await import("postgres");
  // Supabase kabi tashqi serverga — shifrlangan ulanish (satrda sslmode ko‘rsatilmagan bo‘lsa)
  const mahalliy = /@(localhost|127.0.0.1|[::1])[:/]/.test(url);
  const sql = postgres(url, {
    ...(/[?&]sslmode=/.test(url) ? {} : { ssl: mahalliy ? false : "require" }),
    prepare: false,
    max: Number(process.env.MEDIAPRAG_DB_MAX || 3),
    idle_timeout: 20,
    connect_timeout: 15,
    // count(*) va AVG kabi natijalar matn emas, son bo‘lib kelsin
    types: {
      int8: { to: 20, from: [20], parse: songa, serialize: String },
      numeric: { to: 1700, from: [1700], parse: songa, serialize: String },
    },
    onnotice: () => {},
  } as never);
  type Sql = typeof sql;
  const yasash = (s: Sql): Ulanish => ({
    tur: "postgres",
    async sorov(q, p) {
      const r = await s.unsafe(q, p as never[]);
      return { rows: r as unknown as Qator[], soni: r.count ?? r.length };
    },
    async bajar(q) {
      await s.unsafe(q);
    },
    tranzaksiya: (fn) => s.begin((tx) => fn(yasash(tx as unknown as Sql))) as never,
    yopish: () => sql.end(),
  });
  return yasash(sql);
}

async function pgliteUlanish(joy: string): Promise<Ulanish> {
  const { PGlite } = await import("@electric-sql/pglite");
  const xotirada = joy === "memory://";
  if (!xotirada) (await import("node:fs")).mkdirSync(joy, { recursive: true });
  const db = await PGlite.create(xotirada ? undefined : joy, { parsers: { 20: songa, 1700: songa } });
  type Tx = { query: (q: string, p?: unknown[]) => Promise<{ rows: unknown[]; affectedRows?: number }>; exec: (q: string) => Promise<unknown> };
  const yasash = (s: Tx, ildiz: boolean): Ulanish => ({
    tur: "pglite",
    async sorov(q, p) {
      const r = await s.query(q, p);
      return { rows: r.rows as Qator[], soni: r.affectedRows ?? r.rows.length };
    },
    async bajar(q) {
      await s.exec(q);
    },
    tranzaksiya: (fn) => (ildiz ? db.transaction((tx) => fn(yasash(tx as unknown as Tx, false))) : fn(yasash(s, false))),
    yopish: () => db.close(),
  });
  return yasash(db as unknown as Tx, true);
}

/**
 * MEDIAPRAG_DB aniq berilsa (demo, testlar) — doim PGlite: .env.local dagi DATABASE_URL demo ma’lumotlarni
 * haqiqiy bazaga yozib yubormasligi uchun. Aks holda DATABASE_URL, u ham bo‘lmasa — data/pglite.
 */
export function bazaManzili(): { tur: "postgres"; url: string } | { tur: "pglite"; joy: string } {
  const joy = process.env.MEDIAPRAG_DB?.trim();
  const url = process.env.DATABASE_URL?.trim();
  if (url && !joy) return { tur: "postgres", url };
  if (joy === "memory://") return { tur: "pglite", joy };
  // Nisbiy yo‘l ishchi papkaga nisbatan ochiladi (process.cwd() bilan yo‘l yasash Vercel’da butun loyihani bundle’ga tortadi)
  return { tur: "pglite", joy: joy || "data/pglite" };
}

async function ochish(): Promise<Ulanish> {
  const m = bazaManzili();
  if (m.tur === "pglite" && process.env.VERCEL) {
    throw new Error("DATABASE_URL o‘rnatilmagan: Vercel’da doimiy disk yo‘q, Supabase ulanish satrini kiriting");
  }
  const u = m.tur === "postgres" ? await postgresUlanish(m.url) : await pgliteUlanish(m.joy);
  await sxemaniTayyorlash(u);
  return u;
}

/** Sxema va boshlang‘ich ma’lumotlar — bir marta; bir vaqtda ishga tushgan serverlar to‘qnashmasligi uchun qulf ostida. */
async function sxemaniTayyorlash(u: Ulanish) {
  const versiya = async () => {
    const jadval = await u.sorov("SELECT to_regclass('public.sozlamalar') IS NOT NULL AS bor", []);
    if (!jadval.rows[0]?.bor) return 0;
    const r = await u.sorov("SELECT qiymat FROM sozlamalar WHERE kalit = 'sxema_versiya'", []);
    return Number(r.rows[0]?.qiymat ?? 0);
  };
  if ((await versiya()) >= SXEMA_VERSIYASI) return;
  await u.tranzaksiya(async (tx) => {
    await tx.sorov("SELECT pg_advisory_xact_lock(4207118)", []);
    // qulfni kutgan paytda boshqa server nusxasi allaqachon yangilagan bo‘lishi mumkin
    const joriy = await (async () => {
      const jadval = await tx.sorov("SELECT to_regclass('public.sozlamalar') IS NOT NULL AS bor", []);
      if (!jadval.rows[0]?.bor) return 0;
      const r = await tx.sorov("SELECT qiymat FROM sozlamalar WHERE kalit = 'sxema_versiya'", []);
      return Number(r.rows[0]?.qiymat ?? 0);
    })();
    if (joriy >= SXEMA_VERSIYASI) return;
    await tx.bajar(SCHEMA);
    const bor = await tx.sorov("SELECT 1 FROM sozlamalar WHERE kalit = 'metodika_versiya'", []);
    if (!bor.rows.length) await boshlangichMalumotlar(tx);
    for (const m of MIGRATSIYALAR) {
      if (m.versiya <= joriy) continue;
      await m.bajar(tx);
      await tx.sorov(
        "INSERT INTO migratsiyalar (versiya, nomi, qollangan) VALUES ($1, $2, $3) ON CONFLICT (versiya) DO NOTHING",
        [m.versiya, m.nomi, hozir()],
      );
    }
    await tx.sorov(
      "INSERT INTO sozlamalar (kalit, qiymat) VALUES ('sxema_versiya', $1) ON CONFLICT (kalit) DO UPDATE SET qiymat = excluded.qiymat",
      [String(SXEMA_VERSIYASI)],
    );
  });
}

/**
 * Statistikaga kiradigan materiallar sharti (SQL, «m» — materiallar jadvali taxallusi).
 * Sun’iy (namuna) va tekshirilmagan materiallar Dashboard, Analitika va hisobotlarga kirmaydi.
 * Namoyish rejimida (MEDIAPRAG_NAMOYISH=1 — demo baza) sun’iy materiallar ham ko‘rsatiladi.
 */
export const namoyishRejimi = () => process.env.MEDIAPRAG_NAMOYISH === "1";
export function hisobgaShart(a = "m"): string {
  return namoyishRejimi() ? `${a}.tekshirilgan` : `(${a}.tekshirilgan AND ${a}.manba_turi <> 'suniy')`;
}

async function boshlangichMalumotlar(u: Ulanish) {
  for (const [kod, nomi, vazn, tavsif] of MEZONLAR) {
    await u.sorov("INSERT INTO mezonlar (kod, nomi, vazn, tavsif) VALUES ($1, $2, $3, $4)", [kod, nomi, vazn, tavsif]);
  }
  for (const [i, [kod, nomi, guruh, m, jarima]] of KATEGORIYALAR.entries()) {
    await u.sorov("INSERT INTO kategoriyalar (kod, nomi, guruh, mezon, jarima, tartib) VALUES ($1, $2, $3, $4, $5, $6)", [
      kod, nomi, guruh, m, jarima, i,
    ]);
  }
  for (const [turkum, qatorlar] of Object.entries(LUGAT)) {
    for (const [i, [kod, nomi, qiymat]] of qatorlar.entries()) {
      await u.sorov("INSERT INTO lugat (turkum, kod, nomi, qiymat, tartib) VALUES ($1, $2, $3, $4, $5)", [turkum, kod, nomi, qiymat, i]);
    }
  }
  for (const [nomi, turi] of NASHRLAR) await u.sorov("INSERT INTO nashrlar (nomi, turi) VALUES ($1, $2)", [nomi, turi]);
  await u.sorov("INSERT INTO sozlamalar (kalit, qiymat) VALUES ('metodika_versiya', '1'), ('shkala', $1)", [JSON.stringify(SHKALA)]);
  const snapshot = {
    versiya: 1,
    vaznlar: Object.fromEntries(MEZONLAR.map(([kod, , vazn]) => [kod, vazn])),
    muvofiqlik: Object.fromEntries(LUGAT.muvofiqlik.map(([kod, , qiymat]) => [kod, qiymat])),
    kompozitsiya: Object.fromEntries(LUGAT.kompozitsiya.map(([kod, , qiymat]) => [kod, qiymat])),
    kategoriyalar: Object.fromEntries(
      KATEGORIYALAR.map(([kod, nomi, guruh, mezon, jarima], tartib) => [kod, { kod, nomi, guruh, mezon, jarima, tartib }]),
    ),
    shkala: SHKALA,
  };
  await u.sorov("INSERT INTO metodika_tarixi (versiya, sana, izoh, snapshot) VALUES (1, $1, $2, $3)", [
    hozir(),
    "Boshlang‘ich metodika (III bob)",
    JSON.stringify(snapshot),
  ]);
}

// Dev rejimida hot reload ulanishni takrorlamasligi uchun global keshlanadi
const g = globalThis as unknown as { mediapragDb?: Promise<Ulanish> };

export function getDb(): Promise<Ulanish> {
  if (!g.mediapragDb) {
    g.mediapragDb = ochish().catch((e) => {
      g.mediapragDb = undefined; // keyingi so‘rovda qayta urinib ko‘riladi
      throw e;
    });
  }
  return g.mediapragDb;
}

/** Testlar uchun: ulanishni yopish (keyingi getDb() yangisini ochadi). */
export async function bazaniYopish() {
  const u = g.mediapragDb;
  g.mediapragDb = undefined;
  if (u) await (await u).yopish();
}

// ------------------------------------------------------------------ so‘rovlar

const joriyTx = new AsyncLocalStorage<Ulanish>();
const ulanish = async () => joriyTx.getStore() ?? (await getDb());

export async function all<T = Qator>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await (await ulanish()).sorov(parametrlar(sql), params);
  return r.rows as T[];
}

export async function one<T = Qator>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return (await all<T>(sql, params))[0];
}

/** INSERT/UPDATE/DELETE; changes — o‘zgargan qatorlar soni. Yangi id kerak bo‘lsa — «RETURNING id» bilan one(). */
export async function run(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
  const r = await (await ulanish()).sorov(parametrlar(sql), params);
  return { changes: r.soni };
}

/** Bitta tranzaksiya; ichidagi barcha so‘rovlar unga bog‘lanadi. Ichma-ich chaqirilsa — tashqisining bir qismi. */
export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  if (joriyTx.getStore()) return fn();
  return (await getDb()).tranzaksiya((tx) => joriyTx.run(tx, fn));
}

/**
 * Nusxadan tiklagandan keyin: xeshi yo‘q materiallarga xesh yoziladi, manba arxivining endi mos
 * kelmaydigan yozuvlari (material o‘chirilgan yoki shu raqamda endi boshqa material) olib tashlanadi.
 */
export async function tiklashdanKeyinTozalash(): Promise<void> {
  for (const q of await all<{ id: number; sarlavha: string; lid: string | null; matn: string | null }>(
    "SELECT id, sarlavha, lid, matn FROM materiallar WHERE matn_hash IS NULL",
  )) {
    await run("UPDATE materiallar SET matn_hash = ? WHERE id = ?", [matnHeshi(q), q.id]);
  }
  await run(
    `DELETE FROM manba_arxivi a WHERE NOT EXISTS (
       SELECT 1 FROM materiallar m WHERE m.id = a.material_id AND m.yaratilgan = a.material_yaratilgan)`,
  );
}
