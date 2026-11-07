import { getTranslations } from "next-intl/server";
import { Container, SectionHeading } from "@/components/ui/card";
import { Reveal } from "./reveal";
import { DomainSearch } from "./domain-search";

/** Sección de la portada: buscar un dominio sin registrarse. */
export async function DomainSection() {
  const t = await getTranslations("domains");
  return (
    <section id="domains" className="py-20 scroll-mt-16 border-t border-border bg-bg-elevated">
      <Container>
        <Reveal>
          <SectionHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        </Reveal>
        <div className="mt-10"><DomainSearch /></div>
      </Container>
    </section>
  );
}
