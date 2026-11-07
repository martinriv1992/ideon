import type { ProjectKind } from "@/types/database.types";

/** Tipos de solución que el cliente puede elegir (orientan el cuestionario, la arquitectura y la generación). */
export const PROJECT_KINDS: ProjectKind[] = ["web", "crm", "inventory", "erp", "dashboard", "portal", "app", "other"];
