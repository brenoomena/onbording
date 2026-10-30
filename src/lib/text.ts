/** Versão em texto corrido, sem marcações, para prévias de uma ou duas linhas. */
export function plainText(md: string | null | undefined): string {
  if (!md) return "";
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/(\*\*|__|\*|_|~~|`)/g, "")
    .replace(/^-{3,}$/gm, "")
    .replace(/\s*\n+\s*/g, " · ")
    .replace(/^ · | · $/g, "")
    .trim();
}

/** Aceita "site.com.br", "www…", "https://…" e e-mails; devolve o endereço completo ou null. */
export function normalizeUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v || /\s/.test(v)) return null;
  if (/^(https?:\/\/|mailto:)/i.test(v)) return v.replace(/\(/g, "%28").replace(/\)/g, "%29");
  if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v)) return `mailto:${v}`;
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i.test(v)) return `https://${v.replace(/\(/g, "%28").replace(/\)/g, "%29")}`;
  return null;
}
