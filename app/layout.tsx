import type { Metadata } from "next";
import { cookies } from "next/headers";

import { Backdrop } from "@/components/ui/Backdrop";
import { DemoBanner } from "@/components/bosh/DemoBanner";
import { Buyruqlar } from "@/components/ui/Buyruqlar";
import { Effektlar } from "@/components/ui/Effektlar";
import { Nav } from "@/components/ui/Nav";
import { Providers } from "@/components/ui/Providers";
import { joriyMavzu, joriyTil, serverTarjimon } from "@/lib/i18n/server";
import { MENYU_COOKIE, menyuniOlish } from "@/lib/menyu";
import { joriyFoydalanuvchi } from "@/lib/sessiya";

import "@fontsource-variable/manrope";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await serverTarjimon();
  return { title: "MediaPrag-Analytics", description: t("nav.brendSub") };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const til = await joriyTil();
  const mavzu = await joriyMavzu();
  const menyu = menyuniOlish((await cookies()).get(MENYU_COOKIE)?.value);
  // Kirish sahifasida (yoki baza vaqtincha ishlamasa) foydalanuvchi yo‘q — menyu ko‘rsatilmaydi
  const f = await joriyFoydalanuvchi().catch(() => null);
  const foydalanuvchi = f ? { ism: f.ism, rol: f.rol, demo: f.demo } : null;
  return (
    // Mavzu va menyu kengligi serverda qo‘yiladi — sahifa ochilganda «miltillash» va sakrash bo‘lmaydi
    <html
      lang={til}
      data-theme={mavzu === "system" ? undefined : mavzu}
      data-menyu={menyu === "yigiq" ? "yigiq" : undefined}
      suppressHydrationWarning
    >
      <body>
        <Backdrop />
        <Providers til={til} mavzu={mavzu} foydalanuvchi={foydalanuvchi}>
          <Nav menyu={menyu} />
          <main className={`app-main ${foydalanuvchi ? "menyu-bilan" : ""}`}>
            <div className="mx-auto w-full max-w-[1340px] px-4 pb-24 pt-5 sm:px-6 lg:pt-8">
              {f?.demo && <DemoBanner />}
              {children}
            </div>
          </main>
          {foydalanuvchi && <Buyruqlar />}
          <Effektlar />
        </Providers>
      </body>
    </html>
  );
}
