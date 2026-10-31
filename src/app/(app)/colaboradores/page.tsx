import { Eye, Filter, Pencil, Search, UserCheck, UserPlus, UserX, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { ActionButton } from "@/components/forms";
import { Card, EmptyState, IconLink, Input, LinkButton, PageHeader, RowActions, Select, StatusBadge, Table, buttonVariants, formatDate, formatDateTime } from "@/components/ui";
import { can, isAdmin, requirePermission } from "@/lib/auth";
import { P } from "@/lib/permissions";
import { PROFILE_SELECT, loadStructure, loadSupervisorOptions, type ProfileRow } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL, type UserStatus } from "@/lib/types";
import { setProfileStatus } from "./actions";

export const metadata: Metadata = { title: "Colaboradores" };

const PAGE_SIZE = 25;

type Search = {
  q?: string;
  area?: string;
  cargo?: string;
  nivel?: string;
  status?: string;
  supervisor?: string;
  perfil?: string;
  admissao_de?: string;
  admissao_ate?: string;
  pendente?: string;
  pagina?: string;
};

const isUuid = (v?: string) => !!v && /^[0-9a-f-]{36}$/i.test(v);
const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export default async function ColaboradoresPage({ searchParams }: { searchParams: Promise<Search> }) {
  const me = await requirePermission(P.colaboradoresVer, P.equipeVer);
  const sp = await searchParams;
  const teamOnly = !me.permissions.has(P.colaboradoresVer);
  const canManage = can(me, P.colaboradoresCriar);
  const canEdit = can(me, P.colaboradoresEditar);
  const canDeactivate = can(me, P.colaboradoresDesativar);
  const admin = isAdmin(me);
  const page = Math.max(1, Number(sp.pagina) || 1);

  const supabase = await createClient();
  // Na lista de pendências, o perfil entra como !inner para permitir excluir administradores.
  const select = sp.pendente === "1" ? PROFILE_SELECT.replace("role:roles(", "role:roles!inner(") : PROFILE_SELECT;
  let query = supabase.from("profiles").select(select, { count: "exact" });
  if (teamOnly) query = query.eq("supervisor_id", me.userId);

  const q = (sp.q ?? "").replace(/[%,()*]/g, " ").trim();
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
  if (isUuid(sp.area)) query = query.eq("area_id", sp.area!);
  if (isUuid(sp.cargo)) query = query.eq("position_id", sp.cargo!);
  if (isUuid(sp.nivel)) query = query.eq("level_id", sp.nivel!);
  if (isUuid(sp.supervisor)) query = query.eq("supervisor_id", sp.supervisor!);
  if (isUuid(sp.perfil)) query = query.eq("role_id", sp.perfil!);
  if (sp.status && sp.status in STATUS_LABEL) query = query.eq("status", sp.status as UserStatus);
  if (isDate(sp.admissao_de)) query = query.gte("admission_date", sp.admissao_de!);
  if (isDate(sp.admissao_ate)) query = query.lte("admission_date", sp.admissao_ate!);
  if (sp.pendente === "1") {
    query = query.neq("role.key", "admin").neq("status", "inativo").or("position_id.is.null,level_id.is.null");
  }

  const [{ data, count, error }, structure, supervisors] = await Promise.all([
    query.order("full_name").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    loadStructure(),
    teamOnly ? Promise.resolve([]) : loadSupervisorOptions(),
  ]);
  const rows = (data ?? []) as unknown as ProfileRow[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Object.entries(sp).some(([k, v]) => k !== "pagina" && v);

  const pageHref = (n: number) => {
    const params = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    params.set("pagina", String(n));
    return `/colaboradores?${params}`;
  };

  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        icon={Users}
        title={teamOnly ? "Minha equipe" : "Colaboradores"}
        description={teamOnly ? "Colaboradores dos quais você é supervisor." : "Cadastro de todos os colaboradores da plataforma."}
        actions={
          canManage && (
            <LinkButton href="/colaboradores/novo">
              <UserPlus size={16} aria-hidden /> Cadastrar colaborador
            </LinkButton>
          )
        }
      />

      <Card title="Filtros" description="Refine por área, cargo, status e período de admissão" icon={Filter}>
      <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" method="get">
        <div className="grid gap-1 sm:col-span-2">
          <label htmlFor="q" className="text-[12px] font-medium text-muted">Buscar</label>
          <div className="relative">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input id="q" name="q" defaultValue={sp.q} placeholder="Nome ou e-mail" className="pl-9" />
          </div>
        </div>
        <div className="grid gap-1">
          <label htmlFor="f-area" className="text-[12px] font-medium text-muted">Área</label>
          <Select id="f-area" name="area" defaultValue={sp.area ?? ""}>
            <option value="">Todas</option>
            {structure.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </div>
        <div className="grid gap-1">
          <label htmlFor="f-status" className="text-[12px] font-medium text-muted">Status</label>
          <Select id="f-status" name="status" defaultValue={sp.status ?? ""}>
            <option value="">Todos</option>
            {(Object.keys(STATUS_LABEL) as UserStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </Select>
        </div>
        <div className="grid gap-1">
          <label htmlFor="f-cargo" className="text-[12px] font-medium text-muted">Cargo</label>
          <Select id="f-cargo" name="cargo" defaultValue={sp.cargo ?? ""}>
            <option value="">Todos</option>
            {structure.areas.map((a) => (
              <optgroup key={a.id} label={a.name}>
                {structure.positions.filter((p) => p.area_id === a.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </optgroup>
            ))}
          </Select>
        </div>
        <div className="grid gap-1">
          <label htmlFor="f-nivel" className="text-[12px] font-medium text-muted">Nível</label>
          <Select id="f-nivel" name="nivel" defaultValue={sp.nivel ?? ""}>
            <option value="">Todos</option>
            {structure.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
        </div>
        {!teamOnly && (
          <>
            <div className="grid gap-1">
              <label htmlFor="f-sup" className="text-[12px] font-medium text-muted">Supervisor</label>
              <Select id="f-sup" name="supervisor" defaultValue={sp.supervisor ?? ""}>
                <option value="">Todos</option>
                {supervisors.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </Select>
            </div>
            <div className="grid gap-1">
              <label htmlFor="f-perfil" className="text-[12px] font-medium text-muted">Perfil de acesso</label>
              <Select id="f-perfil" name="perfil" defaultValue={sp.perfil ?? ""}>
                <option value="">Todos</option>
                {structure.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </div>
          </>
        )}
        <div className="grid gap-1">
          <label htmlFor="f-de" className="text-[12px] font-medium text-muted">Admissão a partir de</label>
          <Input id="f-de" name="admissao_de" type="date" defaultValue={sp.admissao_de} />
        </div>
        <div className="grid gap-1">
          <label htmlFor="f-ate" className="text-[12px] font-medium text-muted">Admissão até</label>
          <Input id="f-ate" name="admissao_ate" type="date" defaultValue={sp.admissao_ate} />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <button type="submit" className={buttonVariants.primary}>Filtrar</button>
          {filtered && <Link href="/colaboradores" className={buttonVariants.ghost}>Limpar filtros</Link>}
          <span className="ml-auto text-[12.5px] tabular-nums text-muted">
            {total} {total === 1 ? "colaborador" : "colaboradores"}
          </span>
        </div>
      </form>
      </Card>

      {error ? (
        <EmptyState title="Não foi possível carregar a lista">Atualize a página. Se o erro continuar, avise o administrador.</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState
          title={filtered ? "Nenhum colaborador com esses filtros" : teamOnly ? "Sua equipe ainda não tem colaboradores" : "Nenhum colaborador cadastrado"}
          icon={Users}
          action={!filtered && canManage ? <LinkButton href="/colaboradores/novo">Cadastrar o primeiro</LinkButton> : undefined}
        >
          {teamOnly && !filtered ? "Quando um administrador indicar você como supervisor de alguém, a pessoa aparece aqui." : undefined}
        </EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Área · Cargo · Nível</th>
              <th>Supervisor</th>
              <th>Admissão</th>
              <th>Último acesso</th>
              <th>Status</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <Avatar name={p.full_name} path={p.avatar_path} size={34} />
                    <div className="min-w-0">
                      <Link href={`/colaboradores/${p.id}`} className="font-medium text-heading hover:text-accent">{p.full_name}</Link>
                      <p className="text-[12px] text-muted">{p.email}</p>
                    </div>
                  </div>
                </td>
                <td className="text-[13px]">
                  {[p.area?.name, p.position?.name, p.level?.name].filter(Boolean).join(" · ") || <span className="text-muted">Não definido</span>}
                </td>
                <td className="text-[13px]">{p.supervisor?.full_name ?? <span className="text-muted">—</span>}</td>
                <td className="text-[13px] tabular-nums">{formatDate(p.admission_date)}</td>
                <td className="text-[13px] tabular-nums">{p.last_access_at ? formatDateTime(p.last_access_at) : <span className="text-muted">Nunca acessou</span>}</td>
                <td><StatusBadge status={p.status} /></td>
                <td>
                  <RowActions>
                    <IconLink href={`/colaboradores/${p.id}`} label="Ver cadastro" icon={Eye} />
                    {(canEdit || admin) && (p.role?.key !== "admin" || admin) && (
                      <IconLink href={`/colaboradores/${p.id}/editar`} label="Editar" icon={Pencil} />
                    )}
                    {canDeactivate && p.id !== me.userId && (p.role?.key !== "admin" || admin) &&
                      (p.status === "inativo" ? (
                        <ActionButton action={setProfileStatus} hidden={{ id: p.id, status: "ativo" }} label="Reativar acesso" icon={<UserCheck size={16} aria-hidden />} iconOnly />
                      ) : (
                        <ActionButton
                          action={setProfileStatus}
                          hidden={{ id: p.id, status: "inativo" }}
                          label="Desativar acesso"
                          variant="danger"
                          icon={<UserX size={16} aria-hidden />}
                          iconOnly
                          confirm
                          confirmLabel="Desativar acesso"
                          confirmText={`${p.full_name} perde o acesso na hora. O histórico de estudo e o cadastro ficam guardados e o acesso pode ser reativado.`}
                        />
                      ))}
                  </RowActions>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {pages > 1 && (
        <nav aria-label="Paginação" className="flex items-center justify-between text-[13px]">
          {page > 1 ? <Link href={pageHref(page - 1)} className={buttonVariants.secondary}>Anterior</Link> : <span />}
          <span className="tabular-nums text-muted">Página {page} de {pages}</span>
          {page < pages ? <Link href={pageHref(page + 1)} className={buttonVariants.secondary}>Próxima</Link> : <span />}
        </nav>
      )}
    </>
  );
}
