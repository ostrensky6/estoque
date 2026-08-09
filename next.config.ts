import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs"],
  async redirects() {
    return [
      {
        source: "/orcamentos",
        destination: "/orcamento",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
