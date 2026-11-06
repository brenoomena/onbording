import { Archive, Megaphone, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton, PageNotice } from "@/components/forms";
import { Markdown } from "@/components/markdown";
import { Badge, Card, PageHeader, formatDateTime } from "@/components/ui";
import { can, requireUser } from "@/lib/auth";
import { P } from "@/lib/permissions";
import { loadStructure } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { archiveAnnouncement } from "../actions";

export const metadata: Metadata = { title: "Comunicado" };

export default async function ComunicadoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string; n?: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  const { aviso, n } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("announcements")
    .select("id, title, body, importance, status, published_at, recipients, author:profiles!announcements_created_by_fkey(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!a) notFound();
  const manager = can(me, P.comunicadosGerenciar);

  // Abrir o comunicado conta como lido.
  const { data: mine } = await supabase.from("notifications").select("id").eq("profile_id", me.userId).eq("announcement_id", id).is("read_at", null);
  if (mine?.length) await supabase.rpc("mark_notifications_read", { p_ids: mine.map((x) => x.id) });

  let audience: string[] = [];
  if (manager) {
    const [{ data: rules }, structure] = await Promise.all([supabase.from("announcement_audience").select("area_id, position_id, level_id").eq("announcement_id", id), loadStructure()]);
    const name = (list: { id: string; name: string }[], v: string | null) => (v ? list.find((x) => x.id === v)?.name ?? "?" : null);
    audience = (rules ?? []).map((r) => [name(structure.areas, r.area_id), name(structure.positions, r.position_id), name(structure.levels, r.level_id)].filter(Boolean).join(" · ") || "Todos");
  }
  const author = (a.author as unknown as { full_name: string } | null)?.full_name;

  return (
    <>
      <PageHeader
        eyebrow="Comunicados"
        icon={Megaphone}
        title={a.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {a.importance === "importante" && <Badge tag="comunicado.importante">Importante</Badge>}
            {a.published_at ? `Publicado em ${formatDateTime(a.published_at)}` : "Rascunho"}
            {author && <span>· por {author}</span>}
          </span>
        }
        actions={
          <div className="flex items-center gap-3">
            {manager && a.status === "publicado" && (
              <ActionButton action={archiveAnnouncement} hidden={{ id }} label="Arquivar" icon={<Archive size={15} aria-hidden />} confirm confirmLabel="Arquivar" confirmText="O comunicado some para quem recebeu. Não dá para desfazer." />
            )}
            <Link href={manager ? "/comunicados?aba=gerenciar" : "/comunicados"} className="text-[13px] font-medium text-accent hover:underline">← Comunicados</Link>
          </div>
        }
      />
      {aviso === "arquivado" && <PageNotice message="Comunicado arquivado. Ele some para quem recebeu." />}
      {aviso === "publicado" && <PageNotice message={`Comunicado publicado e enviado para ${Number(n ?? 0)} ${Number(n) === 1 ? "pessoa" : "pessoas"}.`} />}
      <Card>
        <Markdown>{a.body}</Markdown>
      </Card>
      {manager && (
        <Card title="Envio" icon={Users}>
          <dl className="grid gap-3 text-[14px] sm:grid-cols-3">
            <div>
              <dt className="text-[12px] text-muted">Situação</dt>
              <dd>{a.status === "publicado" ? "Publicado" : a.status === "arquivado" ? "Arquivado" : "Rascunho"}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-muted">Destinatários</dt>
              <dd className="tabular-nums">{a.recipients}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-muted">Público</dt>
              <dd>{audience.length ? audience.join("; ") : "Todas as pessoas ativas"}</dd>
            </div>
          </dl>
        </Card>
      )}
    </>
  );
}
