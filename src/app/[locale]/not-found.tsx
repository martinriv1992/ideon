import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

export default function NotFound() {
  const t = useTranslations("common");
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center text-center px-6">
      <Logo withText={false} size={40} />
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">{t("notFound")}</h1>
      <p className="mt-3 text-fg-muted max-w-md">{t("notFoundText")}</p>
      <Link href="/" className="mt-8">
        <Button variant="secondary">{t("goHome")}</Button>
      </Link>
    </main>
  );
}
