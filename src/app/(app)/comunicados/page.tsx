import { Megaphone, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader, Table, buttonVariants, cx, formatDateTime } from "@/components/ui";
import { can, requireUser } from "@/lib/auth";
import { P } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Comunicados" };

interface Received {
  id: string;
  read_at: string | null;
  created_at: string;
  announcement: { id: string; title: string; importance: string; published_at: string } | null;
}
interface Managed {
  id: string;
  title: string;
  status: "rascunho" | "publicado" | "arquivado";
  importance: string;
  recipients: number;
  published_at: string | null;
  updated_at: string;
}

const STATUS: Record<Managed["status"], [string, "neutral" | "ok" | "warn"]> = {
  rascunho: ["Rascunho", "warn"],
  publicado: ["Publicado", "ok"],
  arquivado: ["Arquivado", "neutral"],
};

export default async function ComunicadosPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const me = await requireUser();
  const manager = can(me, P.comunicadosGerenciar);
  const { aba } = await searchParams;
  const tab = manager && aba === "gerenciar" ? "gerenciar" : "recebidos";
  const supabase = await createClient();

  const [{ data: rec }, { data: all }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, read_at, created_at, announcement:announcements(id, title, importance, published_at)")
      .eq("profile_id", me.userId)
      .eq("kind", "comunicado")
      .order("created_at", { ascending: false })
      .limit(100),
    manager && tab === "gerenciar"
      ? supabase.from("announcements").select("id, title, status, importance, recipients, published_at, updated_at").order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] as Managed[] }),
  ]);
  const received = ((rec ?? []) as unknown as Received[]).filter((r) => r.announcement);
  const managed = (all ?? []) as Managed[];

  return (
    <>
      <PageHeader
        eyebrow="Comunicação"
        icon={Megaphone}
        title="Comunicados"
        description="Recados da empresa para você e a sua equipe."
        actions={
          manager ? (
            <Link href="/comunicados/novo" className={buttonVariants.primary}>
              <Plus size={16} aria-hidden /> Novo comunicado
            </Link>
          ) : undefined
        }
      />
      {manager && (
        <div role="tablist" aria-label="Comunicados" className="flex gap-1.5">
          {(
            [
              ["recebidos", "Recebidos"],
              ["gerenciar", "Gerenciar"],
            ] as const
          ).map(([k, label]) => (
            <Link
              key={k}
              href={k === "recebidos" ? "/comunicados" : "/comunicados?aba=gerenciar"}
              role="tab"
              aria-selected={tab === k}
              className={cx("rounded-lg border px-3 py-1.5 text-[13px] font-medium", tab === k ? "border-accent/30 bg-accent-soft text-accent" : "border-line bg-surface text-muted hover:text-ink")}
            >
              {label}
            </Link>
          ))}
        </div>
      )}

      {tab === "recebidos" ? (
        <Card flush>
          {received.length === 0 ? (
            <EmptyState icon={Megaphone} title="Nenhum comunicado recebido">
              Quando a empresa publicar um comunicado para você, ele aparece aqui e no sininho.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {received.map((r) => (
                <li key={r.id}>
                  <Link href={`/comunicados/${r.announcement!.id}`} className={cx("flex items-center gap-3 px-5 py-3.5 hover:bg-sunken", !r.read_at && "bg-accent-soft/30")}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-tag-orange-soft text-tag-orange">
                      <Megaphone size={17} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cx("block truncate text-[14px] text-heading", !r.read_at && "font-semibold")}>{r.announcement!.title}</span>
                      <span className="text-[12px] text-muted">{formatDateTime(r.announcement!.published_at)}</span>
                    </span>
                    {r.announcement!.importance === "importante" && <Badge tone="danger">Importante</Badge>}
                    {!r.read_at && <span aria-label="Não lido" className="h-2 w-2 shrink-0 rounded-full bg-brand" />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : managed.length === 0 ? (
        <Card>
          <EmptyState icon={Megaphone} title="Nenhum comunicado criado" action={<Link href="/comunicados/novo" className={buttonVariants.primary}>Criar o primeiro</Link>}>
            Escreva um recado, escolha o público e publique: cada pessoa recebe um aviso.
          </EmptyState>
        </Card>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Comunicado</th>
              <th>Situação</th>
              <th>Destinatários</th>
              <th>Publicado em</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {managed.map((a) => (
              <tr key={a.id}>
                <td>
                  <span className="font-medium">{a.title}</span>
                  {a.importance === "importante" && (
                    <span className="ml-2">
                      <Badge tone="danger">Importante</Badge>
                    </span>
                  )}
                </td>
                <td>
                  <Badge tone={STATUS[a.status][1]}>{STATUS[a.status][0]}</Badge>
                </td>
                <td className="tabular-nums">{a.status === "rascunho" ? "—" : a.recipients}</td>
                <td className="text-[13px]">{a.published_at ? formatDateTime(a.published_at) : "—"}</td>
                <td className="text-right">
                  <Link href={a.status === "rascunho" ? `/comunicados/${a.id}/editar` : `/comunicados/${a.id}`} className="text-[13px] font-medium text-accent hover:underline">
                    {a.status === "rascunho" ? "Editar" : "Ver"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
