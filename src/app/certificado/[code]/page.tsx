import { createClient as createPlainClient } from "@supabase/supabase-js";
import { BadgeCheck, CircleX } from "lucide-react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { formatHours, formatScore, longDate, shortDate } from "@/lib/certificate";
import { publicEnv } from "@/lib/env";
import { VerifyForm } from "../verify-form";

export const metadata: Metadata = { title: "Validação de certificado", robots: { index: false } };
export const dynamic = "force-dynamic";

interface Verified {
  code: string;
  person_name: string;
  track_name: string;
  hours: number | null;
  average_score: number | null;
  completed_at: string;
  issued_at: string;
}

/** Validação pública (sem login): confirma se o código pertence a um certificado emitido. */
export default async function VerificarPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = decodeURIComponent(code).toUpperCase().trim();
  let cert: Verified | null = null;
  if (/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(clean)) {
    const sb = createPlainClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data } = await sb.rpc("verify_certificate", { p_code: clean });
    cert = (data as Verified | null) ?? null;
  }

  if (!cert) {
    return (
      <AuthShell title="Certificado não encontrado" description={`Não há certificado emitido com o código ${clean}. Confira se digitou igual ao impresso.`}>
        <div className="grid gap-4">
          <p className="flex items-center gap-2 text-[13.5px] font-semibold text-heading">
            <CircleX size={18} aria-hidden className="text-red-400" /> Código inválido
          </p>
          <VerifyForm defaultValue={clean} />
        </div>
      </AuthShell>
    );
  }

  const rows: [string, string | null][] = [
    ["Nome", cert.person_name],
    ["Trilha", cert.track_name],
    ["Concluída em", longDate(cert.completed_at)],
    ["Carga horária", formatHours(cert.hours === null ? null : Number(cert.hours))],
    ["Média nas avaliações", formatScore(cert.average_score === null ? null : Number(cert.average_score))],
    ["Emitido em", shortDate(cert.issued_at)],
    ["Código", cert.code],
  ];
  return (
    <AuthShell title="Certificado válido" description="Este certificado foi emitido pela plataforma de onboarding da Implantta.">
      <div className="grid gap-4">
        <p className="flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-[13.5px] font-semibold text-heading ring-1 ring-emerald-400/40">
          <BadgeCheck size={18} aria-hidden className="text-emerald-400" /> Autêntico
        </p>
        <dl className="grid gap-2.5">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="grid grid-cols-[130px_1fr] gap-3 border-b border-line/60 pb-2 text-[13.5px] last:border-0">
                <dt className="text-muted">{k}</dt>
                <dd className={k === "Código" ? "font-mono font-semibold text-heading" : "font-medium text-heading"}>{v}</dd>
              </div>
            ))}
        </dl>
      </div>
    </AuthShell>
  );
}
