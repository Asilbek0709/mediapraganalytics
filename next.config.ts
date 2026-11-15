import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit o‘z shrift fayllarini, PGlite — WebAssembly va ma’lumot fayllarini diskdan o‘qiydi: bundle qilinmaydi
  serverExternalPackages: ["pdfkit", "@electric-sql/pglite", "postgres"],
  // PDF shriftlari diskdan o‘qiladi — Vercel’dagi server bundle’iga aniq qo‘shiladi
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf", "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf"],
  },
};

export default nextConfig;
