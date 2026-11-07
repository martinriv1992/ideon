import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Convierte texto en slug URL-safe (sin acentos, minúsculas, guiones). */
export function slugify(input: string, maxLength = 48) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

/** Deriva un nombre de proyecto razonable a partir de la idea del usuario. */
export function deriveProjectName(idea: string, fallback: string) {
  const firstSentence = idea.split(/[.\n!?]/)[0]?.trim() ?? "";
  const words = firstSentence.split(/\s+/).filter(Boolean);
  const name = words.slice(0, 7).join(" ");
  const clean = name.replace(/^(quiero|necesito|i want|i need|me gustaría|i'd like)\s+(un|una|a|an|to)?\s*/i, "");
  const result = (clean || name).trim();
  if (!result) return fallback;
  return result.charAt(0).toUpperCase() + result.slice(1, 80);
}

export function formatDate(value: string | Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatRelative(value: string | Date, locale: string) {
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}
