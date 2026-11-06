import {
  AlarmClock,
  ChartColumnIncreasing,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Filter,
  GraduationCap,
  ListChecks,
  Route,
  Search,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProgressBar } from "@/components/progress-bar";
import {
  Badge,
  Card,
  EmptyState,
  Field,
  Input,
  LevelBadge,
  PageHeader,
  Select,
  StatCard,
  Table,
  buttonVariants,
  cx,
  formatDate,
  formatDateTime,
  ENROLLMENT_TONE,
} from "@/components/ui";
import {
  PARADO_OPCOES,
  PARADO_PADRAO,
  SITUACAO_LABEL,
  attention,
  byPerson,
  byTrack,
  daysSince,
  formatDuration,
  funnel,
  parseFilters,
  situacaoOf,
  summarize,
  type Filters,
  type Situacao,
} from "@/lib/acompanhamento";
import { can, requirePermission } from "@/lib/auth";
import { todayBR } from "@/lib/learning";
import { P } from "@/lib/permissions";
import { loadStructure, loadSupervisorOptions } from "@/lib/queries";
import { loadTrack } from "../trilhas/[id]/load";
import { createClient } from "@/lib/supabase/server";
import { PageNotice } from "@/components/forms";
import { DueDateForm } from "./due-date-form";
import { parseVista, type Vista } from "./export";
import { loadAcompanhamento } from "./load";
import { ENROLLMENT_TAG } from "@/lib/tags";
import type { TagKey } from "@/lib/tag-catalog";

export const metadata: Metadata = { title: "Acompanhamento" };

const SIT_TAG: Record<Situacao, TagKey> = { ...ENROLLMENT_TAG, atrasada: "matricula.em_atraso" };

type SP = Record<string, string | string[] | undefined>;

/** Endereço com os filtros atuais e as mudanças pedidas (vazio remove). */
function hrefWith(f: Filters, vista: Vista, change: Record<string, string | undefined>, path = "/acompanhamento") {
  const base: Record<string, string | undefined> = {
    vista: vista === "pessoas" ? undefined : vista,
    trilha: f.trilha,
    area: f.area,
    cargo: f.cargo,
    nivel: f.nivel,
    supervisor: f.supervisor,
    situacao: f.situacao,
    de: f.de,
    ate: f.ate,
    parado: f.parado === PARADO_PADRAO ? undefined : String(f.parado),
  };
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...change })) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

function since(iso: string | null | undefined, today: string): string {
  const d = daysSince(iso, today);
  if (d === null) return "Nunca estudou";
  if (d === 0) return "Hoje";
  if (d === 1) return "Ontem";
  return `Há ${d} dias`;
}

export default async function AcompanhamentoPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requirePermission(P.progressoVer, P.equipeVer, P.avaliacoesCorrigir);
  const sp = await searchParams;
  const f = parseFilters(sp);
  const vista = parseVista(sp.vista);
  const today = todayBR();
  const etapasId = typeof sp.etapas === "string" && /^[0-9a-f-]{36}$/i.test(sp.etapas) ? sp.etapas : null;

  const [data, structure, supervisors] = await Promise.all([
    loadAcompanhamento(me, f, today),
    loadStructure(),
    can(me, P.progressoVer) ? loadSupervisorOptions() : Promise.resolve([]),
  ]);
  // Avaliações aguardando correção, no alcance de quem corrige (o banco limita).
  const canGrade = can(me, P.avaliacoesCorrigir);
  const { data: pendRows } = canGrade
    ? await (await createClient())
        .from("quiz_attempts")
        .select("id, submitted_at, score, profile_id, profile:profiles!quiz_attempts_profile_id_fkey(full_name, email), content:contents(title, track_id)")
        .eq("status", "em_correcao")
        .order("submitted_at")
    : { data: [] };
  const corrections = ((pendRows ?? []) as unknown as {
    id: string;
    submitted_at: string;
    score: number;
    profile_id: string;
    profile: { full_name: string; email: string } | null;
    content: { title: string; track_id: string | null } | null;
  }[]).filter((c) => c.profile_id !== me.userId);
  const corrigida = sp.aviso === "aprovada" || sp.aviso === "reprovada" ? sp.aviso : null;
  const s = summarize(data.rows, today);
  const people = byPerson(data.rows, data.people, data.tracks, data.activity, data.seconds, data.lastByPerson, today, f.parado);
  const tracks = byTrack(data.rows, data.tracks, data.activity, today, f.parado);
  const alerts = attention(data.rows, data.people, data.tracks, data.activity, today, f.parado);
  const canOpenPerson = can(me, P.colaboradoresVer) || can(me, P.equipeVer);
  const canDue = can(me, P.trilhasMatricular);
  const areaName = new Map(structure.areas.map((a) => [a.id, a.name]));
  const cargoName = new Map(structure.positions.map((p) => [p.id, p.name]));
  const nivelName = new Map(structure.levels.map((l) => [l.id, l.name]));
  const filtered = !!(f.trilha || f.area || f.cargo || f.nivel || f.supervisor || f.situacao || f.de || f.ate);
  const trackOptions = [...data.tracks.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  // Etapas da trilha escolhida: quantas pessoas (dos filtros atuais) concluíram cada uma.
  let etapas: { name: string; enrolled: number; steps: ReturnType<typeof funnel> } | null = null;
  if (etapasId && data.tracks.has(etapasId)) {
    const loaded = await loadTrack(etapasId);
    if (loaded) {
      const enrolledIds = [...new Set(data.rows.filter((r) => r.track_id === etapasId).map((r) => r.profile_id))];
      const steps = loaded.modules.flatMap((m) =>
        m.items
          .filter((i) => i.content.status === "publicado")
          .map((i) => ({ contentId: i.content.id, title: i.content.title, moduleTitle: m.title, required: i.is_required })),
      );
      etapas = { name: loaded.track.name, enrolled: enrolledIds.length, steps: funnel(steps, enrolledIds, data.completed) };
    }
  }

  const exportHref = (formato: "csv" | "xlsx") => hrefWith(f, vista, { vista, formato }, "/acompanhamento/exportar");
  const correctionsTab = canGrade ? [{ key: "correcoes" as const, label: "Correções", icon: ClipboardCheck, count: corrections.length }] : [];
  const person = (id: string, name: string) =>
    canOpenPerson ? (
      <Link href={`/colaboradores/${id}`} className="font-medium text-heading hover:text-accent">
        {name}
      </Link>
    ) : (
      <span className="font-medium text-heading">{name}</span>
    );

  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        icon={ChartColumnIncreasing}
        title="Acompanhamento"
        description={
          data.teamOnly
            ? "Progresso da sua equipe nas trilhas: quem está em dia, quem está atrasado e onde as pessoas param."
            : "Progresso de todos nas trilhas: quem está em dia, quem está atrasado e onde as pessoas param."
        }
        actions={
          vista === "correcoes" ? undefined : <div className="flex flex-wrap gap-2">
            <a href={exportHref("xlsx")} className={buttonVariants.secondary} download>
              <Download size={16} aria-hidden /> Excel
            </a>
            <a href={exportHref("csv")} className={buttonVariants.secondary} download>
              <Download size={16} aria-hidden /> CSV
            </a>
          </div>
        }
      />

      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Matrículas"
          value={s.matriculas}
          hint={`${s.pessoas} ${s.pessoas === 1 ? "pessoa" : "pessoas"}, ${s.naoIniciadas} sem iniciar`}
          icon={GraduationCap}
          href={hrefWith(f, vista, { situacao: undefined })}
        />
        <StatCard
          label="Em andamento"
          value={s.emAndamento}
          hint="Sem concluir"
          icon={Route}
          tone="neutral"
          href={hrefWith(f, vista, { situacao: "em_andamento" })}
        />
        <StatCard label="Concluídas" value={s.concluidas} hint="Trilhas em 100%" icon={CheckCircle2} tone="ok" href={hrefWith(f, vista, { situacao: "concluida" })} />
        <StatCard
          label="Em atraso"
          value={s.atrasadas}
          hint="Prazo vencido"
          icon={AlarmClock}
          tone={s.atrasadas ? "danger" : "neutral"}
          href={hrefWith(f, "atencao", { situacao: "atrasada" })}
        />
        <StatCard label="Conclusão média" value={`${s.media}%`} hint="Das matrículas" icon={ListChecks} tone="brand" />
      </section>

      <Card title="Filtros" description="Os indicadores, as visões e a exportação seguem estes filtros." icon={Filter}>
        <form method="get" action="/acompanhamento" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {vista !== "pessoas" && <input type="hidden" name="vista" value={vista} />}
          <Field label="Trilha" htmlFor="f-trilha">
            <Select id="f-trilha" name="trilha" defaultValue={f.trilha ?? ""}>
              <option value="">Todas</option>
              {trackOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.status !== "publicado" ? " (rascunho)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Situação" htmlFor="f-sit">
            <Select id="f-sit" name="situacao" defaultValue={f.situacao ?? ""}>
              <option value="">Todas</option>
              {(Object.keys(SITUACAO_LABEL) as Situacao[]).map((k) => (
                <option key={k} value={k}>
                  {SITUACAO_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Área" htmlFor="f-area">
            <Select id="f-area" name="area" defaultValue={f.area ?? ""}>
              <option value="">Todas</option>
              {structure.areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cargo" htmlFor="f-cargo">
            <Select id="f-cargo" name="cargo" defaultValue={f.cargo ?? ""}>
              <option value="">Todos</option>
              {structure.positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nível" htmlFor="f-nivel">
            <Select id="f-nivel" name="nivel" defaultValue={f.nivel ?? ""}>
              <option value="">Todos</option>
              {structure.levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
          {!data.teamOnly && (
            <Field label="Supervisor" htmlFor="f-sup">
              <Select id="f-sup" name="supervisor" defaultValue={f.supervisor ?? ""}>
                <option value="">Todos</option>
                {supervisors.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Admissão de" htmlFor="f-de">
            <Input id="f-de" type="date" name="de" defaultValue={f.de ?? ""} />
          </Field>
          <Field label="Admissão até" htmlFor="f-ate">
            <Input id="f-ate" type="date" name="ate" defaultValue={f.ate ?? ""} />
          </Field>
          <Field label="Parada: sem estudo há" htmlFor="f-parado" hint="Matrícula não concluída sem atividade na trilha.">
            <Select id="f-parado" name="parado" defaultValue={String(f.parado)}>
              {PARADO_OPCOES.map((d) => (
                <option key={d} value={d}>
                  {d} dias ou mais
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3 lg:justify-end">
            {filtered && (
              <Link href={vista === "pessoas" ? "/acompanhamento" : `/acompanhamento?vista=${vista}`} className={buttonVariants.ghost}>
                <X size={15} aria-hidden /> Limpar filtros
              </Link>
            )}
            <button type="submit" className={buttonVariants.primary}>
              <Search size={16} aria-hidden /> Filtrar
            </button>
          </div>
        </form>
      </Card>

      <nav aria-label="Visões" className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {(
          [
            { key: "pessoas", label: "Pessoas", icon: Users, count: people.length },
            { key: "trilhas", label: "Trilhas", icon: Route, count: tracks.length },
            { key: "atencao", label: "Atenção", icon: TriangleAlert, count: alerts.length },
            ...correctionsTab,
          ] as const
        ).map((t) => {
          const on = t.key === vista;
          return (
            <Link
              key={t.key}
              href={hrefWith(f, t.key, {})}
              aria-current={on ? "page" : undefined}
              className={cx(
                "flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-[13.5px] font-medium transition-colors",
                on ? "bg-accent-soft text-heading shadow-[inset_0_-2px_0_rgb(var(--brand))]" : "text-muted hover:bg-sunken hover:text-ink",
              )}
            >
              <t.icon size={16} aria-hidden className={on ? "text-icon" : ""} />
              {t.label}
              <span
                className={cx(
                  "rounded-full px-1.5 text-[11px] tabular-nums",
                  (t.key === "atencao" || t.key === "correcoes") && t.count ? "bg-danger-soft text-danger" : on ? "bg-surface text-ink" : "bg-sunken",
                )}
              >
                {t.count}
              </span>
            </Link>
          );
        })}
      </nav>

      {corrigida && (
        <PageNotice
          tone={corrigida === "aprovada" ? "ok" : "warn"}
          message={`Correção salva: ${corrigida === "aprovada" ? "aprovada" : "não atingiu a nota mínima"} com ${typeof sp.nota === "string" ? sp.nota : "?"}%.`}
        />
      )}
      {vista === "correcoes" ? (
        corrections.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Nenhuma avaliação aguardando correção">
            Quando alguém enviar uma avaliação com resposta aberta, ela aparece aqui para você corrigir.
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Avaliação</th>
                <th>Enviada em</th>
                <th className="text-right">Objetivas</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {corrections.map((c) => (
                <tr key={c.id}>
                  <td className="min-w-[200px]">
                    {person(c.profile_id, c.profile?.full_name ?? "Colaborador")}
                    <p className="text-[12px] text-muted">{c.profile?.email}</p>
                  </td>
                  <td className="min-w-[180px] text-[13.5px]">
                    {c.content?.title}
                    {c.content?.track_id && <p className="text-[12px] text-muted">{data.tracks.get(c.content.track_id)?.name}</p>}
                  </td>
                  <td className="whitespace-nowrap text-[13px]">{formatDateTime(c.submitted_at)}</td>
                  <td className="text-right tabular-nums text-[13px]">{Math.round(Number(c.score))}%</td>
                  <td className="whitespace-nowrap text-right">
                    <Link href={`/acompanhamento/correcao/${c.id}`} className={cx(buttonVariants.primary, "py-1.5 text-[13px]")}>
                      <ClipboardCheck size={15} aria-hidden /> Corrigir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )
      ) : data.rows.length === 0 ? (
        <EmptyState icon={ChartColumnIncreasing} title={filtered ? "Nenhuma matrícula com esses filtros" : "Ainda não há matrículas para acompanhar"}>
          {filtered
            ? "Ajuste ou limpe os filtros para ver mais resultados."
            : data.teamOnly
              ? "Quando alguém da sua equipe for matriculado numa trilha, o progresso aparece aqui."
              : "Quando os colaboradores forem matriculados nas trilhas, o progresso aparece aqui."}
        </EmptyState>
      ) : vista === "pessoas" ? (
        <Table>
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Trilhas</th>
              <th className="w-[160px]">Conclusão</th>
              <th>Último estudo</th>
              <th>Tempo de estudo</th>
              <th>Próximo prazo</th>
              <th>Atenção</th>
            </tr>
          </thead>
          <tbody>
            {people.map((r) => (
              <tr key={r.person.id}>
                <td className="min-w-[220px]">
                  {person(r.person.id, r.person.full_name)}
                  <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                    {[areaName.get(r.person.area_id ?? ""), cargoName.get(r.person.position_id ?? "")].filter(Boolean).join(" · ") || r.person.email}
                    {r.person.level_id && <LevelBadge name={nivelName.get(r.person.level_id)} />}
                  </p>
                </td>
                <td className="min-w-[220px]">
                  <div className="flex flex-wrap gap-1">
                    {r.trilhas.slice(0, 3).map((t) => (
                      <span key={t.id} title={`${t.name}: ${SITUACAO_LABEL[t.situacao]}, ${t.percent}%`}>
                        <Badge tag={SIT_TAG[t.situacao]}>
                          {t.name} · {t.percent}%
                        </Badge>
                      </span>
                    ))}
                    {r.trilhas.length > 3 && <Badge>+{r.trilhas.length - 3}</Badge>}
                  </div>
                </td>
                <td>
                  <ProgressBar value={r.percent} label={`${r.concluidas} de ${r.trilhas.length}`} />
                </td>
                <td className="whitespace-nowrap text-[13px]">{since(r.ultimaAtividade, today)}</td>
                <td className="whitespace-nowrap text-[13px] tabular-nums">{formatDuration(r.segundos)}</td>
                <td className={cx("whitespace-nowrap text-[13px]", r.proximoPrazo && r.proximoPrazo < today && "font-semibold text-danger")}>
                  {formatDate(r.proximoPrazo)}
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {r.atrasadas > 0 && <Badge tag="alerta.atraso">{r.atrasadas} em atraso</Badge>}
                    {r.paradas > 0 && <Badge tag="alerta.parada">{r.paradas} parada{r.paradas > 1 ? "s" : ""}</Badge>}
                    {!r.atrasadas && !r.paradas && <span className="text-[12.5px] text-muted">Em dia</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : vista === "trilhas" ? (
        <>
          {etapas && (
            <Card
              title={`Onde as pessoas param · ${etapas.name}`}
              description={`Quantas das ${etapas.enrolled} pessoas matriculadas (com os filtros atuais) concluíram cada etapa publicada, na ordem da trilha.`}
              icon={ListChecks}
              actions={
                <Link href={hrefWith(f, vista, {})} className={buttonVariants.ghost} aria-label="Fechar etapas">
                  <X size={15} aria-hidden /> Fechar
                </Link>
              }
            >
              <Steps steps={etapas.steps} enrolled={etapas.enrolled} />
            </Card>
          )}
          <Table>
            <thead>
              <tr>
                <th>Trilha</th>
                <th className="text-right">Matrículas</th>
                <th className="text-right">Não iniciadas</th>
                <th className="text-right">Em andamento</th>
                <th className="text-right">Concluídas</th>
                <th className="text-right">Em atraso</th>
                <th className="text-right">Paradas</th>
                <th className="w-[150px]">Conclusão média</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {tracks.map((t) => (
                <tr key={t.track.id} className={cx(t.track.id === etapasId && "bg-accent-soft/40")}>
                  <td className="min-w-[200px]">
                    <span className="font-medium text-heading">{t.track.name}</span>
                    <p className="flex gap-1.5 text-[12px] text-muted">
                      {t.track.is_mandatory ? "Obrigatória" : "Opcional"}
                      {t.track.status !== "publicado" && <Badge tag="publicacao.rascunho">Rascunho</Badge>}
                    </p>
                  </td>
                  <td className="text-right tabular-nums">{t.matriculas}</td>
                  <td className="text-right tabular-nums">{t.naoIniciadas}</td>
                  <td className="text-right tabular-nums">{t.emAndamento}</td>
                  <td className="text-right tabular-nums">{t.concluidas}</td>
                  <td className={cx("text-right tabular-nums", t.atrasadas > 0 && "font-semibold text-danger")}>{t.atrasadas}</td>
                  <td className={cx("text-right tabular-nums", t.paradas > 0 && "font-semibold text-tag-orange")}>{t.paradas}</td>
                  <td>
                    <ProgressBar value={t.media} label="" />
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <Link href={`${hrefWith(f, vista, { etapas: t.track.id })}#etapas`} className="text-[13px] font-medium text-accent hover:underline">
                      Ver etapas
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      ) : alerts.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Ninguém precisa de atenção">
          Nenhuma matrícula com prazo vencido nem sem estudo há {f.parado} dias ou mais, com os filtros atuais.
        </EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Trilha</th>
              <th className="w-[130px]">Progresso</th>
              <th>Motivo</th>
              <th>Último estudo na trilha</th>
              <th>{canDue ? "Prazo (ajustar)" : "Prazo"}</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.enrollment.id}>
                <td className="min-w-[200px]">
                  {person(a.person.id, a.person.full_name)}
                  <p className="text-[12px] text-muted">{a.person.email}</p>
                </td>
                <td className="min-w-[160px] text-[13.5px]">
                  {a.track.name}
                  <p>
                    <Badge tag={SIT_TAG[situacaoOf(a.enrollment, today)]}>{SITUACAO_LABEL[situacaoOf(a.enrollment, today)]}</Badge>
                  </p>
                </td>
                <td>
                  <ProgressBar value={Number(a.enrollment.progress_percent)} label="" />
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {a.atrasada && <Badge tag="alerta.atraso">Prazo vencido</Badge>}
                    {a.parada && <Badge tag="alerta.parada">Sem estudo há {a.diasSemAtividade} dias</Badge>}
                  </div>
                </td>
                <td className="whitespace-nowrap text-[13px]">{a.ultimaAtividade ? formatDate(a.ultimaAtividade) : "Nunca estudou"}</td>
                <td className="whitespace-nowrap">
                  {canDue ? (
                    <DueDateForm id={a.enrollment.id} value={a.enrollment.due_date} label={`Prazo de ${a.person.full_name} em ${a.track.name}`} />
                  ) : (
                    <span className={cx("text-[13px]", a.atrasada && "font-semibold text-danger")}>{formatDate(a.enrollment.due_date)}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

/** Barras por etapa: quantos concluíram, com a maior queda destacada. */
function Steps({ steps, enrolled }: { steps: ReturnType<typeof funnel>; enrolled: number }) {
  if (!steps.length) return <p className="text-[13px] text-muted">A trilha ainda não tem etapas publicadas.</p>;
  if (!enrolled) return <p className="text-[13px] text-muted">Ninguém matriculado nesta trilha com os filtros atuais.</p>;
  let worst = -1;
  let worstDrop = 0;
  steps.forEach((st, i) => {
    const prev = i === 0 ? enrolled : steps.at(i - 1)!.concluiram;
    if (prev - st.concluiram > worstDrop) {
      worstDrop = prev - st.concluiram;
      worst = i;
    }
  });
  return (
    <ol id="etapas" className="grid scroll-mt-24 gap-2.5">
      {steps.map((st, i) => {
        const pct = Math.round((st.concluiram / enrolled) * 100);
        return (
          <li key={st.contentId} className="grid gap-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-center sm:gap-4">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="w-6 shrink-0 text-right font-mono text-[12px] text-muted">{i + 1}</span>
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-medium" title={st.title}>
                  {st.title}
                </p>
                <p className="truncate text-[11.5px] text-muted">
                  {st.moduleTitle}
                  {!st.required && " · opcional"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 pl-8 sm:pl-0">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-line" role="img" aria-label={`${st.concluiram} de ${enrolled} concluíram`}>
                <div className={cx("h-full rounded-full", i === worst ? "bg-danger" : "bg-brand")} style={{ width: `${pct}%` }} />
              </div>
              <span className="w-[96px] shrink-0 text-right text-[12.5px] tabular-nums text-muted">
                <strong className="text-ink">{st.concluiram}</strong> de {enrolled} · {pct}%
              </span>
            </div>
            {i === worst && (
              <p className="pl-8 text-[12px] font-medium text-danger sm:col-span-2">
                Maior queda: {worstDrop} {worstDrop === 1 ? "pessoa não concluiu" : "pessoas não concluíram"} esta etapa
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
