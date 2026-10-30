/** Variáveis de ambiente públicas e privadas, validadas no primeiro uso. */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}. Veja o arquivo .env.example.`);
  }
  return value;
}

export const publicEnv = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
  get siteUrl() {
    return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get googleLogin() {
    return process.env.NEXT_PUBLIC_LOGIN_GOOGLE === "true";
  },
  get googleDomain() {
    return (process.env.NEXT_PUBLIC_GOOGLE_DOMAIN ?? "").trim().toLowerCase();
  },
};

/** Só pode ser lida no servidor. */
export function serviceRoleKey(): string {
  if (typeof window !== "undefined") {
    throw new Error("A chave service_role não pode ser usada no navegador.");
  }
  return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}
