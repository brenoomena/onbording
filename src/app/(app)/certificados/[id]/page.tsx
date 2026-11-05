import { Award, Download, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CertificateView } from "@/components/certificate-view";
import { CopyButton } from "@/components/copy-button";
import { Card, PageHeader, buttonVariants } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getBranding } from "@/lib/branding";
import { formatHours, formatScore, longDate } from "@/lib/certificate";
import { CERT_COLUMNS, certificateImages, toCertificateData, validationUrl } from "@/lib/certificate-server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Certificado" };

export default async function CertificadoPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("certificates").select(CERT_COLUMNS).eq("id", id).maybeSingle();
  if (!data) notFound();
  const cert = toCertificateData(data);
  const branding = await getBranding();
  const imgs = certificateImages(branding);
  const url = await validationUrl(cert.code);
  const mine = cert.profile_id === me.userId;

  return (
    <>
      <PageHeader
        eyebrow={mine ? "Meus certificados" : "Certificados"}
        icon={Award}
        title={cert.track_name}
        description={`${mine ? "Concluída" : `${cert.person_name} concluiu`} em ${longDate(cert.completed_at)}.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <a href={`/certificados/${cert.id}/pdf`} className={buttonVariants.primary}>
              <Download size={16} aria-hidden /> Baixar PDF
            </a>
            <CopyButton value={url} label="Copiar link de validação" />
          </div>
        }
      />
      <CertificateView theme={branding.certificate} data={cert} logoUrl={imgs.logoUrl} signatureUrl={imgs.signatureUrl} validationUrl={url} className="mx-auto w-full max-w-[1000px]" />
      <Card title="Dados do certificado" icon={Award}>
        <dl className="grid gap-3 text-[14px] sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-[12px] text-muted">Código de validação</dt>
            <dd className="font-mono font-semibold">{cert.code}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-muted">Carga horária</dt>
            <dd>{formatHours(cert.hours) ?? "Não informada"}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-muted">Média nas avaliações</dt>
            <dd>{formatScore(cert.average_score) ?? "Sem avaliação"}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-muted">Validação pública</dt>
            <dd>
              <Link href={`/certificado/${cert.code}`} target="_blank" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                Abrir página <ExternalLink size={13} aria-hidden />
              </Link>
            </dd>
          </div>
        </dl>
      </Card>
    </>
  );
}
