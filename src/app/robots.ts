import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/** Se indexa el sitio público; la aplicación, el backoffice y la API no. */
export default function robots(): MetadataRoute.Robots {
  const privatePaths = ["/api/", "/s/", "/es/dashboard", "/en/dashboard", "/es/projects", "/en/projects", "/es/admin", "/en/admin", "/es/billing", "/en/billing",
    "/es/settings", "/en/settings", "/es/subscriptions", "/en/subscriptions", "/es/support", "/en/support", "/es/proposals", "/en/proposals", "/es/files", "/en/files"];
  return { rules: [{ userAgent: "*", allow: "/", disallow: privatePaths }], sitemap: `${SITE_URL}/sitemap.xml`, host: SITE_URL };
}
