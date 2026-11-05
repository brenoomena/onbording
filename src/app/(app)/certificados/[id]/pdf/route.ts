import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getBranding } from "@/lib/branding";
import { certificatePdf, fetchImage } from "@/lib/certificate-pdf";
import { CERT_COLUMNS, certificateImages, toCertificateData, validationUrl } from "@/lib/certificate-server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** PDF do certificado (A4 deitado). Quem pode ver o certificado pode baixar. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me?.profile || me.profile.status === "inativo") return new NextResponse("Sessão expirada. Entre novamente.", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Certificado não encontrado.", { status: 404 });
  const supabase = await createClient();
  const { data } = await supabase.from("certificates").select(CERT_COLUMNS).eq("id", id).maybeSingle();
  if (!data) return new NextResponse("Certificado não encontrado.", { status: 404 });
  const cert = toCertificateData(data);
  const branding = await getBranding();
  const imgs = certificateImages(branding);
  const [logo, signature] = await Promise.all([fetchImage(imgs.logoUrl), fetchImage(imgs.signatureUrl)]);
  const bytes = await certificatePdf({ theme: branding.certificate, data: cert, logo, signature, validationUrl: await validationUrl(cert.code) });
  const slug = cert.track_name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificado-${slug || "trilha"}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
