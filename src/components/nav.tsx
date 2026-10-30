"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MenuGroup } from "@/lib/permissions";
import { cx } from "@/components/ui";

export function Nav({ groups }: { groups: MenuGroup[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu principal" className="grid gap-5">
      {groups.map((g, gi) => (
        <div key={g.label ?? `g${gi}`} className="grid gap-1">
          {g.label && (
            <p className="px-3 pb-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted">{g.label}</p>
          )}
          {g.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "rounded-lg px-3 py-2 text-[14px] font-medium transition-colors",
                  active ? "bg-accent-soft text-accent" : "text-ink/80 hover:bg-sunken hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
