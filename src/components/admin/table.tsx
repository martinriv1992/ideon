import { cn } from "@/lib/utils";

export function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (!rows.length) return <p className="text-[13px] text-fg-muted border border-dashed border-border rounded-[12px] p-6 text-center">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-[12px] border border-border">
      <table className="w-full text-[13px]">
        <thead className="bg-surface text-left text-[11px] uppercase tracking-wide text-fg-subtle"><tr>{head.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className={cn("border-t border-border", i % 2 ? "bg-surface/40" : "")}>{r.map((c, k) => <td key={k} className="px-3 py-2 align-top">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return <div className="bg-surface border border-border rounded-[14px] p-4"><p className="text-[12px] text-fg-muted">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>{sub && <p className="text-[12px] text-fg-subtle mt-0.5">{sub}</p>}</div>;
}
