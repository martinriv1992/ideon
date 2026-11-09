import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Las demos de la página de ejemplos se leen del disco en /demo/[slug].
  // El SDK de Ideon Data se incluye en el ZIP y en el despliegue a Vercel de las apps que lo usan.
  outputFileTracingIncludes: {
    "/demo/[slug]": ["./src/content/showcase/*.html"],
    "/demo/p/[token]": ["./src/content/private-demos/*.html"],
    "/api/projects/[id]/download": ["./public/ideon-data.js"],
    "/api/projects/[id]/publish": ["./public/ideon-data.js"],
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
};

export default withNextIntl(nextConfig);
