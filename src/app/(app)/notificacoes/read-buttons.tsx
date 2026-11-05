"use client";

import { CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { buttonVariants, cx } from "@/components/ui";
import { markRead } from "./actions";

export function ReadAllButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await markRead();
          router.refresh();
        })
      }
      className={buttonVariants.secondary}
    >
      <CheckCheck size={16} aria-hidden /> {pending ? "Marcando…" : "Marcar todos como lidos"}
    </button>
  );
}

/** Linha do aviso: marca como lido e abre o link. */
export function ReadOnClick({ id, unread, href, children }: { id: string; unread: boolean; href: string | null; children: ReactNode }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        if (unread) await markRead([id]);
        if (href) router.push(href);
        else router.refresh();
      }}
      className={cx("flex w-full gap-3 px-5 py-3.5 text-left hover:bg-sunken", unread && "bg-accent-soft/30")}
    >
      {children}
    </button>
  );
}
