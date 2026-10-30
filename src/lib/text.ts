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
