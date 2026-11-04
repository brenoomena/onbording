import { cx } from "@/components/ui";
import { initials } from "@/lib/text";

/** Endereço público da foto de perfil guardada no bucket "avatars". */
export function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/avatars/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Foto da pessoa ou, sem foto, as iniciais do nome e sobrenome. */
export function Avatar({ name, path, size = 36, className }: { name: string; path?: string | null; size?: number; className?: string }) {
  const url = avatarUrl(path);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={`Foto de ${name}`} width={size} height={size} style={style} className={cx("shrink-0 rounded-full object-cover", className)} />;
  }
  return (
    <span
      aria-hidden
      style={style}
      className={cx("grid shrink-0 select-none place-items-center rounded-full bg-icon-bg font-semibold tracking-wide text-icon", className)}
    >
      {initials(name)}
    </span>
  );
}
