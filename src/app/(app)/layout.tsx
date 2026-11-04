import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { MENU_COOKIE } from "@/lib/theme";
import { isAdmin, requireUser } from "@/lib/auth";
import { getBranding, logoFor, symbolFor } from "@/lib/branding";
import { visibleMenu } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme } from "@/lib/theme-tokens";

export default async function AppLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  const me = await requireUser();
  const groups = visibleMenu(me.permissions, isAdmin(me));

  // Último acesso (gravado no máximo a cada 5 minutos pelo banco).
  const supabase = await createClient();
  const [, branding, jar] = await Promise.all([supabase.rpc("touch_last_access"), getBranding(), cookies()]);

  const theme = resolveTheme(branding.theme);
  const logo = {
    light: logoFor(branding, theme.light["sidebar-bg"]),
    dark: logoFor(branding, theme.dark["sidebar-bg"]),
    symbolLight: symbolFor(branding, theme.light["sidebar-bg"]),
    symbolDark: symbolFor(branding, theme.dark["sidebar-bg"]),
  };

  return (
    <AppShell
      groups={groups}
      user={{ name: me.profile.full_name, role: me.profile.role.name, avatarPath: me.profile.avatar_path }}
      logo={logo}
      compact={jar.get(MENU_COOKIE)?.value === "compacto"}
      modal={modal}
    >
      {children}
    </AppShell>
  );
}
