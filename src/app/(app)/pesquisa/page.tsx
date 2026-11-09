import { Download, FileStack, Filter, MessageSquareText, Percent, Route, Search, Star, Users, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Stars } from "@/components/stars";
import { Alert, Badge, Card, EmptyState, Field, Input, PageHeader, Select, StatCard, buttonVariants, cx, formatDate } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import {
  RATING_LABEL,
  distPercent,
  filterComments,
  formatAvg,
  parseFeedbackFilters,
  responseRate,
  type Dist,
  type FeedbackFilters,
} from "@/lib/feedback";
import { KIND_LABEL } from "@/lib/learning";
import { P } from "@/lib/permissions";
import { loadStructure } from "@/lib/queries";
import { todayBR } from "@/lib/learning";
import { KIND_TAG } from "@/lib/tags";
import { loadFeedbackReport, parsePesquisaVista, type PesquisaVista } from "./load";

export const metadata: Metadata = { title: "Pesquisa de satisfação" };

type SP = Record<string, string | string[] | undefined>;
const one = (sp: SP, k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) as string | undefined;

const PERIODOS: { value: FeedbackFilters["periodo"]; label: string }[] = [
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "365", label: "Últimos 12 meses" },
  { value: "tudo", label: "Todo o período" },
  { value: "personalizado", label: "Escolher datas" },
];

function hrefWith(f: FeedbackFilters, vista: PesquisaVista, change: Record<string, string | undefined>, path = "/pesquisa") {
  const base: Record<string, string | undefined> = {
    vista: vista === "trilhas" ? undefined : vista,
    periodo: f.periodo === "90" ? undefined : f.periodo,
    de: f.periodo === "personalizado" ? (f.from ?? undefined) : undefined,
    ate: f.periodo === "personalizado" ? (f.to ?? undefined) : undefined,
    area: f.area ?? undefined,
    ...change,
  };
  const q = new URLSearchParams(Object.entries(base).filter((e): e is [string, string] => !!e[1]));
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/** Barrinhas da distribuição (5 → 1), com a % de cada nota. */
function DistBars({ dist, compact = false }: { dist: Dist; compact?: boolean }) {
  const pct = distPercent(dist);
  if (compact) {
    return (
      <span className="flex h-2.5 w-28 overflow-hidden rounded-full bg-sunken" aria-label={`Distribuição: ${[5, 4, 3, 2, 1].map((n) => `${n} estrelas ${pct[n - 1]}%`).join(", ")}`} role="img">
        {[5, 4, 3, 2, 1].map((n) => (
          <span key={n} style={{ width: `${pct[n - 1]}%` }} className={cx("h-full", n >= 4 ? "bg-ok" : n === 3 ? "bg-tag-gold" : "bg-danger", n === 4 && "opacity-70", n === 2 && "opacity-70")} />
        ))}
      </span>
    );
  }
  return (
    <ul className="grid gap-1.5">
      {[5, 4, 3, 2, 1].map((n) => (
        <li key={n} className="grid grid-cols-[minmax(0,auto)_1fr_64px] sm:grid-cols-[120px_1fr_72px] items-center gap-3 text-[13px]">
          <span className="flex items-center gap-1 whitespace-nowrap text-muted">
            {n} <Star size={13} aria-hidden className="text-tag-gold" fill="currentColor" strokeWidth={0} /> <span className="sr-only">estrelas</span>
            <span className="hidden sm:inline">· {RATING_LABEL[n]}</span>
          </span>
          <span className="h-2.5 overflow-hidden rounded-full bg-sunken">
            <span className="block h-full rounded-full bg-tag-gold" style={{ width: `${pct[n - 1]}%` }} />
          </span>
          <span className="text-right tabular-nums text-muted">
            {dist[n - 1]} <span className="text-[12px]">({pct[n - 1]}%)</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function AvgCell({ avg }: { avg: number | null }) {
  return avg == null ? (
    <span className="text-muted">Sem notas</span>
  ) : (
    <span className="flex items-center gap-2">
      <span className="w-7 font-semibold tabular-nums text-heading">{formatAvg(avg)}</span>
      <Stars value={avg} size={14} />
    </span>
  );
}

export default async function PesquisaPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePermission(P.pesquisaVer);
  const sp = await searchParams;
  const today = todayBR();
  const f = parseFeedbackFilters(sp, today);
  const vista = parsePesquisaVista(one(sp, "vista"));
  const [{ report: r, error }, structure] = await Promise.all([loadFeedbackReport(f), loadStructure()]);
  const s = r.summary;
  const rate = responseRate(s.track_responses, s.completions);
  const cf = { nota: one(sp, "nota"), tipo: one(sp, "tipo"), item: one(sp, "item") };
  const comments = filterComments(r.comments, cf);
  const itemName = cf.item ? (r.tracks.find((t) => t.id === cf.item)?.name ?? r.contents.find((c) => c.id === cf.item)?.title) : undefined;
  const filtered = f.periodo !== "90" || !!f.area;
  const exportHref = (formato: "csv" | "xlsx") => hrefWith(f, vista, { vista, formato, nota: cf.nota, tipo: cf.tipo, item: cf.item }, "/pesquisa/exportar");
  const periodText =
    f.periodo === "tudo"
      ? "desde o início"
      : f.from || f.to
        ? `de ${f.from ? formatDate(f.from) : "o início"} até ${f.to ? formatDate(f.to) : "hoje"}`
        : "";

  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        icon={Star}
        title="Pesquisa de satisfação"
        description="O que as pessoas acharam das trilhas e dos conteúdos: notas de 1 a 5, distribuição e comentários. Quem marcou “sem meu nome” aparece como anônimo."
        actions={
          <div className="flex flex-wrap gap-2">
            <a href={exportHref("xlsx")} className={buttonVariants.secondary} download>
              <Download size={16} aria-hidden /> Excel
            </a>
            <a href={exportHref("csv")} className={buttonVariants.secondary} download>
              <Download size={16} aria-hidden /> CSV
            </a>
          </div>
        }
      />

      {error && <Alert>Não foi possível carregar a pesquisa agora. Tente de novo em instantes.</Alert>}

      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Nota média das trilhas"
          value={<span className="flex items-center gap-2">{formatAvg(s.track_avg)} {s.track_avg != null && <Stars value={s.track_avg} size={16} />}</span>}
          hint={s.track_responses ? `${s.track_responses} ${s.track_responses === 1 ? "avaliação" : "avaliações"}` : "Nenhuma avaliação no período"}
          icon={Star}
          tone="warn"
        />
        <StatCard
          label="Taxa de resposta"
          value={rate == null ? "—" : `${rate}%`}
          hint={s.completions ? `${s.track_responses} de ${s.completions} ${s.completions === 1 ? "conclusão" : "conclusões"}` : "Nenhuma trilha concluída no período"}
          icon={Percent}
          tone={rate == null ? "neutral" : rate >= 60 ? "ok" : rate >= 30 ? "warn" : "danger"}
        />
        <StatCard
          label="Nota média dos conteúdos"
          value={<span className="flex items-center gap-2">{formatAvg(s.content_avg)} {s.content_avg != null && <Stars value={s.content_avg} size={16} />}</span>}
          hint={s.content_responses ? `${s.content_responses} ${s.content_responses === 1 ? "avaliação" : "avaliações"}` : "Nenhuma avaliação no período"}
          icon={FileStack}
          tone="brand"
        />
        <StatCard label="Comentários" value={r.comments.length} hint="Trilhas e conteúdos" icon={MessageSquareText} tone="neutral" href={hrefWith(f, "comentarios", {})} />
      </section>

      <Card title="Filtros" description={`Pela data da avaliação${periodText ? ` (${periodText})` : ""} e pela área de quem avaliou. Valem para os números, as visões e a exportação.`} icon={Filter}>
        <form method="get" action="/pesquisa" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {vista !== "trilhas" && <input type="hidden" name="vista" value={vista} />}
          <Field label="Período" htmlFor="p-periodo">
            <Select id="p-periodo" name="periodo" defaultValue={f.periodo}>
              {PERIODOS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="De" htmlFor="p-de" hint="Com “Escolher datas”.">
            <Input id="p-de" type="date" name="de" defaultValue={f.periodo === "personalizado" ? (f.from ?? "") : ""} />
          </Field>
          <Field label="Até" htmlFor="p-ate">
            <Input id="p-ate" type="date" name="ate" defaultValue={f.periodo === "personalizado" ? (f.to ?? "") : ""} />
          </Field>
          <Field label="Área" htmlFor="p-area">
            <Select id="p-area" name="area" defaultValue={f.area ?? ""}>
              <option value="">Todas</option>
              {structure.areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4 lg:justify-end">
            {filtered && (
              <Link href={vista === "trilhas" ? "/pesquisa" : `/pesquisa?vista=${vista}`} className={buttonVariants.ghost}>
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
            { key: "trilhas", label: "Trilhas", icon: Route, count: r.tracks.length },
            { key: "conteudos", label: "Conteúdos", icon: FileStack, count: r.contents.length },
            { key: "comentarios", label: "Comentários", icon: MessageSquareText, count: r.comments.length },
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
              <t.icon size={16} aria-hidden /> {t.label}
              <span className="rounded-full bg-sunken px-1.5 text-[11.5px] tabular-nums">{t.count}</span>
            </Link>
          );
        })}
      </nav>

      {vista === "trilhas" && (
        <>
          {s.track_responses > 0 && (
            <Card title="Distribuição das notas das trilhas" icon={Star}>
              <DistBars dist={s.track_dist} />
            </Card>
          )}
          <Card title="Por trilha" description="Taxa de resposta = avaliações ÷ trilhas concluídas no período." icon={Route} flush>
            {r.tracks.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={Star} title="Nenhuma trilha concluída ou avaliada no período">
                  O convite para avaliar chega no sininho de quem conclui uma trilha.
                </EmptyState>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-[13px]">
                  <thead className="border-b border-line text-[12px] text-muted">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">Trilha</th>
                      <th className="px-3 py-2.5 font-medium">Nota média</th>
                      <th className="px-3 py-2.5 font-medium">Avaliações</th>
                      <th className="px-3 py-2.5 font-medium">Taxa de resposta</th>
                      <th className="px-3 py-2.5 font-medium">Distribuição</th>
                      <th className="px-5 py-2.5 font-medium">Comentários</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {r.tracks.map((t) => {
                      const tr = responseRate(t.responses, t.completions);
                      return (
                        <tr key={t.id}>
                          <td className="px-5 py-2.5 font-medium text-heading">{t.name}</td>
                          <td className="px-3 py-2.5"><AvgCell avg={t.avg} /></td>
                          <td className="px-3 py-2.5 tabular-nums">{t.responses} <span className="text-muted">de {t.completions}</span></td>
                          <td className="px-3 py-2.5 tabular-nums">{tr == null ? <span className="text-muted">—</span> : `${tr}%`}</td>
                          <td className="px-3 py-2.5">{t.responses ? <DistBars dist={t.dist} compact /> : <span className="text-muted">—</span>}</td>
                          <td className="px-5 py-2.5">
                            {t.comments ? (
                              <Link href={hrefWith(f, "comentarios", { item: t.id })} className="font-medium text-accent hover:underline">
                                {t.comments} {t.comments === 1 ? "comentário" : "comentários"}
                              </Link>
                            ) : (
                              <span className="text-muted">Nenhum</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {vista === "conteudos" && (
        <Card title="Por conteúdo" description="Conteúdos avaliados no período, dos mais avaliados para os menos." icon={FileStack} flush>
          {r.contents.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={FileStack} title="Nenhum conteúdo avaliado no período">
                Depois de concluir um conteúdo, a pessoa pode dar uma nota no final da página.
              </EmptyState>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <thead className="border-b border-line text-[12px] text-muted">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Conteúdo</th>
                    <th className="px-3 py-2.5 font-medium">Nota média</th>
                    <th className="px-3 py-2.5 font-medium">Avaliações</th>
                    <th className="px-3 py-2.5 font-medium">Distribuição</th>
                    <th className="px-5 py-2.5 font-medium">Comentários</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {r.contents.map((c) => (
                    <tr key={c.id}>
                      <td className="px-5 py-2.5">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-heading">{c.title}</span>
                          {c.kind in KIND_LABEL && <Badge tag={KIND_TAG[c.kind as keyof typeof KIND_TAG]}>{KIND_LABEL[c.kind as keyof typeof KIND_LABEL]}</Badge>}
                        </span>
                      </td>
                      <td className="px-3 py-2.5"><AvgCell avg={c.avg} /></td>
                      <td className="px-3 py-2.5 tabular-nums">{c.responses}</td>
                      <td className="px-3 py-2.5"><DistBars dist={c.dist} compact /></td>
                      <td className="px-5 py-2.5">
                        {c.comments ? (
                          <Link href={hrefWith(f, "comentarios", { item: c.id })} className="font-medium text-accent hover:underline">
                            {c.comments} {c.comments === 1 ? "comentário" : "comentários"}
                          </Link>
                        ) : (
                          <span className="text-muted">Nenhum</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {vista === "comentarios" && (
        <Card
          title={itemName ? `Comentários: ${itemName}` : "Comentários recentes"}
          description="Os mais recentes primeiro (até 300 no período)."
          icon={MessageSquareText}
          actions={
            <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
              {[undefined, "5", "4", "3", "2", "1"].map((n) => (
                <Link
                  key={n ?? "todas"}
                  href={hrefWith(f, "comentarios", { nota: n, tipo: cf.tipo, item: cf.item })}
                  aria-current={cf.nota === n ? "page" : undefined}
                  className={cx(
                    "flex items-center gap-1 rounded-full border px-2.5 py-1",
                    cf.nota === n ? "border-accent bg-accent-soft font-medium text-heading" : "border-line text-muted hover:bg-sunken",
                  )}
                >
                  {n ? (
                    <>
                      {n} <Star size={12} aria-hidden className="text-tag-gold" fill="currentColor" strokeWidth={0} />
                      <span className="sr-only">estrelas</span>
                    </>
                  ) : (
                    "Todas as notas"
                  )}
                </Link>
              ))}
              {(cf.item || cf.tipo) && (
                <Link href={hrefWith(f, "comentarios", { nota: cf.nota })} className={cx(buttonVariants.ghost, "py-1")}>
                  <X size={14} aria-hidden /> Ver todos
                </Link>
              )}
            </div>
          }
        >
          {comments.length === 0 ? (
            <EmptyState icon={MessageSquareText} title="Nenhum comentário com esses filtros" />
          ) : (
            <ul className="grid gap-3">
              {comments.map((c, i) => (
                <li key={`${c.item_id}-${c.at}-${i}`} className="rounded-xl border border-line px-4 py-3">
                  <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
                    <Stars value={c.rating} size={14} />
                    <Badge tag={c.kind === "trilha" ? "pesquisa.trilha" : "pesquisa.conteudo"}>{c.kind === "trilha" ? "Trilha" : "Conteúdo"}</Badge>
                    <Link href={hrefWith(f, "comentarios", { item: c.item_id, nota: cf.nota })} className="font-medium text-heading hover:text-accent">
                      {c.item}
                    </Link>
                    <span className="ml-auto">{formatDate(c.at)}</span>
                  </div>
                  <p className="whitespace-pre-line text-[13.5px] text-ink">{c.comment}</p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-muted">
                    <Users size={13} aria-hidden />
                    {c.author ? `${c.author}${c.area ? ` · ${c.area}` : ""}` : "Anônimo"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}
