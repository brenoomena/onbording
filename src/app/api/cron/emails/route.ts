import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { emailReady, flushOutbox } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Tarefa diária (Vercel Cron, ver vercel.json): gera os lembretes do dia
 * (prazo, atraso e resumo semanal) e envia a fila. Só com o CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  if (!authorized(req)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const supabase = createAdminClient();
  const { data: jobs, error } = await supabase.rpc("run_email_jobs", {});
  if (error) return NextResponse.json({ error: "Falha ao gerar os lembretes.", detail: error.message }, { status: 500 });

  const totals = { sent: 0, failed: 0, skipped: 0 };
  let configured = emailReady();
  // Envia em lotes até esvaziar a fila (ou chegar perto do limite de tempo).
  const started = Date.now();
  while (configured && Date.now() - started < 45_000) {
    const r = await flushOutbox(50);
    configured = r.configured;
    totals.sent += r.sent;
    totals.failed += r.failed;
    totals.skipped += r.skipped;
    if (r.sent + r.failed + r.skipped === 0 || (r.sent === 0 && r.failed > 0)) break;
  }
  return NextResponse.json({ jobs, configured: emailReady(), ...totals });
}
