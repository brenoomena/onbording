import Link from "next/link";
import { Wordmark } from "@/components/auth-shell";
import { Avatar } from "@/components/avatar";
import { Nav } from "@/components/nav";
import { requireUser } from "@/lib/auth";
import { visibleMenu } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser();
  const groups = visibleMenu(me.permissions);

  // Último acesso (gravado no máximo a cada 5 minutos pelo banco).
  const supabase = await createClient();
  await supabase.rpc("touch_last_access");

  const userBlock = (
    <div className="grid gap-2 border-t border-line pt-4">
      <Link href="/meu-perfil" className="flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-1 hover:bg-sunken" title="Meu perfil">
        <Avatar name={me.profile.full_name} path={me.profile.avatar_path} size={36} />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold">{me.profile.full_name}</span>
          <span className="block truncate text-[12px] text-muted">{me.profile.role.name}</span>
        </span>
      </Link>
      <form action="/sair" method="post" className="px-1">
        <button type="submit" className="w-full rounded-lg px-2 py-1.5 text-left text-[13px] font-medium text-muted hover:bg-sunken hover:text-ink">
          Sair
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      {/* Barra lateral (telas largas) */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line bg-surface px-3 py-5 lg:flex">
        <div className="px-3">
          <Wordmark compact />
        </div>
        <div className="flex-1 overflow-y-auto">
          <Nav groups={groups} />
        </div>
        {userBlock}
      </aside>

      {/* Cabeçalho com menu recolhível (celular e tablet) */}
      <header className="sticky top-0 z-20 border-b border-line bg-surface lg:hidden">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 [&::-webkit-details-marker]:hidden">
            <Wordmark compact />
            <span className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium group-open:bg-sunken">Menu</span>
          </summary>
          <div className="grid gap-4 border-t border-line px-3 py-4">
            <Nav groups={groups} />
            {userBlock}
          </div>
        </details>
      </header>

      <main className="min-w-0 px-4 py-6 sm:px-8 lg:py-8">
        <div className="mx-auto grid max-w-6xl gap-6">{children}</div>
      </main>
    </div>
  );
}
