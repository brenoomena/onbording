import { Award, Download, Eye } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, PageHeader, buttonVariants, cx } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatHours, formatScore, longDate } from "@/lib/certificate";
import { CERT_COLUMNS, toCertificateData } from "@/lib/certificate-server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Meus certificados" };

/** Certificados das trilhas que a pessoa concluiu. */
export default async function MeusCertificadosPage() {
  const me = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("certificates").select(CERT_COLUMNS).eq("profile_id", me.userId).order("completed_at", { ascending: false });
  const certs = (data ?? []).map(toCertificateData);

  return (
    <>
      <PageHeader
        eyebrow="Aprendizagem"
        icon={Award}
        title="Meus certificados"
        description="Ao concluir uma trilha, o certificado aparece aqui na hora. Baixe em PDF ou compartilhe o link de validação."
      />
      {certs.length === 0 ? (
        <Card>
          <EmptyState icon={Award} title="Nenhum certificado ainda">
            Conclua todas as etapas obrigatórias de uma trilha, incluindo as avaliações, para receber o certificado.
            <div className="mt-3">
              <Link href="/minhas-trilhas" className={buttonVariants.secondary}>
                Ver minhas trilhas
              </Link>
            </div>
          </EmptyState>
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {certs.map((c) => (
            <li key={c.id} className="group relative overflow-hidden rounded-2xl border border-line bg-surface">
              <div aria-hidden className="absolute right-0 top-0 h-20 w-20 [clip-path:polygon(100%_0,0_0,100%_100%)] bg-icon-bg" />
              <div className="relative grid gap-3 p-5">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-icon-bg text-icon">
                  <Award size={22} aria-hidden />
                </span>
                <div>
                  <p className="text-[16px] font-semibold leading-snug text-heading">{c.track_name}</p>
                  <p className="mt-0.5 text-[13px] text-muted">Concluída em {longDate(c.completed_at)}</p>
                </div>
                <p className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-muted">
                  {formatHours(c.hours) && <span>{formatHours(c.hours)}</span>}
                  {formatScore(c.average_score) && <span>Média {formatScore(c.average_score)}</span>}
                  <span className="font-mono">{c.code}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/certificados/${c.id}`} className={cx(buttonVariants.secondary, "py-1.5 text-[13px]")}>
                    <Eye size={15} aria-hidden /> Ver
                  </Link>
                  <a href={`/certificados/${c.id}/pdf`} className={cx(buttonVariants.primary, "py-1.5 text-[13px]")}>
                    <Download size={15} aria-hidden /> Baixar PDF
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
