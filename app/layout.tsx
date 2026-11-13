import type { Metadata } from "next";

import { Backdrop } from "@/components/ui/Backdrop";
import { Nav } from "@/components/ui/Nav";
import { Providers } from "@/components/ui/Providers";
import { joriyMavzu, joriyTil, serverTarjimon } from "@/lib/i18n/server";

import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await serverTarjimon();
  return { title: "MediaPrag-Analytics", description: t("nav.brendSub") };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const til = await joriyTil();
  const mavzu = await joriyMavzu();
  return (
    // Mavzu serverda qo‘yiladi — sahifa ochilganda «miltillash» bo‘lmaydi
    <html lang={til} data-theme={mavzu === "system" ? undefined : mavzu} suppressHydrationWarning>
      <body>
        <Backdrop />
        <Providers til={til} mavzu={mavzu}>
          <Nav />
          <main className="mx-auto w-full max-w-[1340px] px-5 pb-24 pt-7">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
