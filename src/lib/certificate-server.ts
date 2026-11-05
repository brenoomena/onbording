import "server-only";
import { headers } from "next/headers";
import { brandingUrl, logoFor, type Branding } from "@/lib/branding";
import { validationPath, type CertificateData } from "@/lib/certificate";
import { publicEnv } from "@/lib/env";

/** Endereço público do site (para o link de validação e o QR code). */
export async function siteOrigin(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env && !/localhost/.test(env)) return env.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return publicEnv.siteUrl;
  const proto = h.get("x-forwarded-proto") ?? (/^localhost|^127\./.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

export async function validationUrl(code: string): Promise<string> {
  return `${await siteOrigin()}${validationPath(code)}`;
}

/** Logo (versão para fundo claro) e assinatura usadas no certificado. */
export function certificateImages(b: Branding): { logoUrl: string | null; signatureUrl: string | null } {
  return { logoUrl: logoFor(b, "#ffffff")?.src ?? null, signatureUrl: brandingUrl(b.certificate.signaturePath) };
}

export const CERT_COLUMNS = "id, code, profile_id, track_id, person_name, track_name, hours, average_score, completed_at, issued_at";

export interface CertificateRow extends CertificateData {
  id: string;
  profile_id: string;
  track_id: string;
}

export function toCertificateData(r: Record<string, unknown>): CertificateRow {
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    id: String(r.id),
    profile_id: String(r.profile_id),
    track_id: String(r.track_id),
    code: String(r.code),
    person_name: String(r.person_name),
    track_name: String(r.track_name),
    hours: num(r.hours),
    average_score: num(r.average_score),
    completed_at: String(r.completed_at),
    issued_at: String(r.issued_at),
  };
}
