import { cn } from "@/lib/utils";

/** Marca Ideonapp: isotipo (nodo que se convierte en producto) + wordmark. */
export function Logo({
  className,
  withText = true,
  size = 28,
}: {
  className?: string;
  withText?: boolean;
  size?: number;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden
        className="shrink-0"
      >
        <defs>
          <linearGradient id="ideon-g" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0" stopColor="#8b7cf6" />
            <stop offset="1" stopColor="#5eb0ff" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#ideon-g)" />
        <circle cx="11" cy="16" r="3.2" fill="#0b0a14" />
        <path
          d="M14 16h5M19 16l-3-3M19 16l-3 3"
          stroke="#0b0a14"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="21" y="11" width="4" height="10" rx="1.5" fill="#0b0a14" />
      </svg>
      {withText && (
        <span className="text-[17px] font-semibold tracking-tight text-fg">
          ideon<span className="text-fg-muted font-medium">app</span>
        </span>
      )}
    </span>
  );
}
