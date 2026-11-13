import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit o‘z shrift ma’lumotlarini fayl tizimidan o‘qiydi — uni bundle qilmaslik kerak
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
