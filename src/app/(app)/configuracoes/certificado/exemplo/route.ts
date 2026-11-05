import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getBranding } from "@/lib/branding";
import { SAMPLE_CERTIFICATE } from "@/lib/certificate";
import { certificatePdf, fetchImage } from "@/lib/certificate-pdf";
import { certificateImages, validationUrl } from "@/lib/certificate-server";

export const dynamic = "force-dynamic";

/** PDF de exemplo com o modelo salvo (para o Administrador conferir a impressão). */
export async function GET() {
  const me = await getCurrentUser();
  if (me?.profile?.role.key !== "admin") return new NextResponse("Somente administradores.", { status: 403 });
  const branding = await getBranding();
  const imgs = certificateImages(branding);
  const [logo, signature] = await Promise.all([fetchImage(imgs.logoUrl), fetchImage(imgs.signatureUrl)]);
  const bytes = await certificatePdf({
    theme: branding.certificate,
    data: { ...SAMPLE_CERTIFICATE, issued_at: new Date().toISOString(), completed_at: new Date().toISOString() },
    logo,
    signature,
    validationUrl: await validationUrl(SAMPLE_CERTIFICATE.code),
  });
  return new NextResponse(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="certificado-exemplo.pdf"', "Cache-Control": "no-store" },
  });
}
