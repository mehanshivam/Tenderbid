import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist", "html-to-docx"],
  turbopack: {},
};

export default nextConfig;
