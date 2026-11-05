// Apoio dos testes ponta a ponta: a plataforma só entra com Google, que não
// existe no ambiente local. Para os testes, damos uma senha à conta (só aqui)
// e colocamos a sessão do Supabase nos cookies do navegador, como o login real faria.
import { createServerClient } from "@supabase/ssr";

const API = "http://localhost:54321";
const BASE = "http://localhost:3000";
const TEST_PASS = "SoParaTeste!2026";
const ANON = process.env.ANON_KEY;
const SK = process.env.SERVICE_KEY;
const admin = { apikey: SK, Authorization: `Bearer ${SK}`, "Content-Type": "application/json" };

async function authUserId(email) {
  const r = await fetch(`${API}/auth/v1/admin/users?per_page=1000`, { headers: admin });
  const { users } = await r.json();
  return users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
}

/** Cliente do Supabase com os cookies num "pote" (como o navegador guardaria). */
export function cookieClient() {
  const jar = new Map();
  const sb = createServerClient(API, ANON, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach((c) => jar.set(c.name, c.value)) },
  });
  return { sb, cookies: () => [...jar].map(([name, value]) => ({ name, value, url: BASE })) };
}

/** Entra na plataforma como `email` (conta liberada pelo cadastro). */
export async function entrar(page, email) {
  const id = await authUserId(email);
  if (!id) throw new Error(`Sem login liberado para ${email}`);
  await fetch(`${API}/auth/v1/admin/users/${id}`, { method: "PUT", headers: admin, body: JSON.stringify({ password: TEST_PASS }) });
  const { sb, cookies } = cookieClient();
  const { error } = await sb.auth.signInWithPassword({ email, password: TEST_PASS });
  if (error) throw new Error(`login de teste falhou para ${email}: ${error.message}`);
  await page.context().clearCookies();
  await page.context().addCookies(cookies());
  await page.goto(`${BASE}/painel`);
}

export { authUserId, API, BASE, admin as ADMIN_HEADERS };
