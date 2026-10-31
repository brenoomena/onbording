import { LibraryBig } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { loadProgressOf } from "@/lib/my-learning";
import { createClient } from "@/lib/supabase/server";
import { MaterialsBrowser, type Material } from "./materials-browser";

export const metadata: Metadata = { title: "Materiais" };

type Row = Omit<Material, "fileUrl"> & { storage_path: string | null };

export default async function MateriaisPage() {
  const me = await requireUser();
  const supabase = await createClient();
  const [{ data }, progress] = await Promise.all([
    supabase
      .from("contents")
      .select("id, title, description, category, kind, body, url, storage_path, mime_type, file_name, file_size, external_platform, access_note, objective, estimated_minutes")
      .eq("is_library", true)
      .eq("status", "publicado")
      .order("title"),
    loadProgressOf(me.userId),
  ]);
  const rows = (data ?? []) as Row[];

  // Links temporários (1 h) para os arquivos enviados à plataforma.
  const paths = rows.map((r) => r.storage_path).filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await supabase.storage.from("conteudos").createSignedUrls(paths, 3600);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }

  const items: Material[] = rows.map(({ storage_path, ...r }) => ({ ...r, fileUrl: storage_path ? signed.get(storage_path) ?? null : null }));

  return (
    <>
      <PageHeader
        eyebrow="Aprendizagem"
        icon={LibraryBig}
        title="Materiais de apoio"
        description="Vídeos, apresentações e catálogos para consultar quando precisar, inclusive durante as reuniões com clientes. Clique para ver sem sair da lista."
      />
      <MaterialsBrowser items={items} viewed={[...progress.byContent.keys()]} />
    </>
  );
}
