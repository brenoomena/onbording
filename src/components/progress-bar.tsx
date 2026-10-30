import { cx } from "@/components/ui";

export function ProgressBar({ value, label, className }: { value: number; label?: string; className?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cx("grid gap-1", className)}>
      {label !== undefined && (
        <div className="flex justify-between text-[12px] tabular-nums text-muted">
          <span>{label}</span>
          <span className="font-semibold text-ink">{v}%</span>
        </div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
        <div className={cx("h-full rounded-full transition-[width]", v === 100 ? "bg-ok" : "bg-brand")} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
