import "server-only";

/**
 * Capa de proveedor de modelos. La plataforma habla con esta interfaz;
 * los proveedores concretos (Anthropic hoy, OpenAI mañana) se añaden aquí.
 */
export interface CompletionRequest {
  system: string;
  user: string;
  maxOutputTokens: number;
  model: string;
  /** Pistas para el proveedor mock (determinista en pruebas). */
  task: AgentTask;
}

export interface CompletionResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  truncated: boolean;
}

export type AgentTask = "consultant" | "architect" | "developer" | "modify";

export interface AIProvider {
  readonly name: string;
  complete(req: CompletionRequest): Promise<CompletionResult>;
}

export interface ModelPolicy {
  task: AgentTask | PolicyKey;
  provider: string;
  model: string;
  maxOutputTokens: number;
  inputCostPerMtok: number;
  outputCostPerMtok: number;
}

/**
 * Políticas por defecto. Las «*_preview» se usan mientras el proyecto está en la
 * vista previa gratuita (Claude Haiku 5.5, ≈ 20 veces más barato); al activarse,
 * desarrollo y modificaciones pasan a Claude Sonnet 5.5.
 */
export type PolicyKey = AgentTask | "developer_preview" | "modify_preview";

export const DEFAULT_POLICIES: Record<PolicyKey, ModelPolicy> = {
  consultant: { task: "consultant", provider: "anthropic", model: "claude-haiku-5-5", maxOutputTokens: 4096, inputCostPerMtok: 0.1, outputCostPerMtok: 0.5 },
  architect: { task: "architect", provider: "anthropic", model: "claude-haiku-5-5", maxOutputTokens: 8192, inputCostPerMtok: 0.1, outputCostPerMtok: 0.5 },
  developer_preview: { task: "developer", provider: "anthropic", model: "claude-haiku-5-5", maxOutputTokens: 64000, inputCostPerMtok: 0.1, outputCostPerMtok: 0.5 },
  modify_preview: { task: "modify", provider: "anthropic", model: "claude-haiku-5-5", maxOutputTokens: 64000, inputCostPerMtok: 0.1, outputCostPerMtok: 0.5 },
  developer: { task: "developer", provider: "anthropic", model: "claude-sonnet-5-5", maxOutputTokens: 64000, inputCostPerMtok: 2, outputCostPerMtok: 10 },
  modify: { task: "modify", provider: "anthropic", model: "claude-sonnet-5-5", maxOutputTokens: 64000, inputCostPerMtok: 2, outputCostPerMtok: 10 },
};

/**
 * Esfuerzo por tarea: controla cuánto razona el modelo (y cuántos tokens de
 * salida se facturan). El consultor solo formula preguntas: esfuerzo bajo.
 */
export const TASK_EFFORT: Record<AgentTask, "low" | "medium" | "high"> = {
  consultant: "low",
  architect: "medium",
  developer: "medium",
  modify: "medium",
};

export function estimateCostUsd(p: ModelPolicy, inputTokens: number, outputTokens: number) {
  return (inputTokens / 1_000_000) * p.inputCostPerMtok + (outputTokens / 1_000_000) * p.outputCostPerMtok;
}

export class AINotConfiguredError extends Error {
  code = "ai_not_configured" as const;
  constructor() {
    super("No hay proveedor de IA configurado. Define ANTHROPIC_API_KEY (o AI_PROVIDER=mock para pruebas).");
  }
}

export function aiProviderName(): "anthropic" | "mock" | null {
  if (process.env.AI_PROVIDER === "mock") return "mock";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export async function getProvider(): Promise<AIProvider> {
  const name = aiProviderName();
  if (name === "mock") return (await import("./mock")).mockProvider;
  if (name === "anthropic") return (await import("./anthropic")).anthropicProvider;
  throw new AINotConfiguredError();
}
