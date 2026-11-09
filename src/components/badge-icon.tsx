import { AlarmClockCheck, Crown, Flag, Flame, Footprints, Handshake, Library, Medal, Star, Target, type LucideIcon } from "lucide-react";
import { cx } from "@/components/ui";
import { BADGE_TONE } from "@/lib/gamification";

const ICONS: Record<string, LucideIcon> = {
  footprints: Footprints,
  flag: Flag,
  library: Library,
  crown: Crown,
  star: Star,
  target: Target,
  alarm: AlarmClockCheck,
  flame: Flame,
  handshake: Handshake,
};

/** Medalha redonda; apagada quando ainda não foi conquistada. */
export function BadgeIcon({ icon, tone, earned = true, size = 56, label }: { icon: string; tone: string; earned?: boolean; size?: number; label?: string }) {
  const Icon = ICONS[icon] ?? Medal;
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cx("grid shrink-0 place-items-center rounded-full ring-2", earned ? BADGE_TONE[tone] ?? BADGE_TONE.blue : "bg-sunken text-muted/60 ring-line grayscale")}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.46)} aria-hidden />
    </span>
  );
}
