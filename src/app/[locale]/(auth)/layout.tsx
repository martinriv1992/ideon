import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/ui/logo";
import { LocaleSwitcher } from "@/components/marketing/locale-switcher";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh grid lg:grid-cols-[1.1fr_1fr]">
      <aside className="hidden lg:flex relative flex-col justify-between p-12 border-r border-border bg-bg-elevated overflow-hidden">
        <div className="absolute inset-0 grid-fade pointer-events-none" aria-hidden />
        <div
          className="absolute -left-40 top-1/3 w-[600px] h-[600px] rounded-full bg-accent/15 blur-[140px] pointer-events-none"
          aria-hidden
        />
        <Link href="/" className="relative">
          <Logo />
        </Link>
        <blockquote className="relative max-w-md">
          <p className="text-2xl font-medium tracking-tight leading-snug text-gradient">
            Tu idea. Nuestra inteligencia. Tu próximo negocio.
          </p>
          <p className="mt-4 text-[14px] text-fg-muted">
            Your idea. Our intelligence. Your next business.
          </p>
        </blockquote>
        <p className="relative text-[12px] text-fg-subtle">© {new Date().getFullYear()} Ideon</p>
      </aside>

      <main className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between lg:justify-end">
          <Link href="/" className="lg:hidden">
            <Logo />
          </Link>
          <LocaleSwitcher />
        </div>
        <div className="flex-1 flex items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
    </div>
  );
}
