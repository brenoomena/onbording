import "server-only";
import {
  SITUACAO_LABEL,
  attention,
  byPerson,
  byTrack,
  daysSince,
  situacaoOf,
  type Filters,
} from "@/lib/acompanhamento";
import type { PersonOption, Structure } from "@/lib/queries";
import type { AcompanhamentoData } from "./load";

export type Vista = "pessoas" | "trilhas" | "atencao";

export function parseVista(v: unknown): Vista {
  return v === "trilhas" || v === "atencao" ? v : "pessoas";
}

type Kind = "text" | "number" | "percent" | "date";
export interface Sheet {
  name: string;
  columns: { header: string; kind: Kind; width: number }[];
  rows: (string | number | null)[][];
}

/** Planilha da visão atual, já com os filtros aplicados. */
export function buildSheet(
  vista: Vista,
  data: AcompanhamentoData,
  structure: Structure,
  supervisors: PersonOption[],
  f: Filters,
  today: string,
): Sheet {
  const area = new Map(structure.areas.map((a) => [a.id, a.name]));
  const cargo = new Map(structure.positions.map((p) => [p.id, p.name]));
  const nivel = new Map(structure.levels.map((l) => [l.id, l.name]));
  const sup = new Map(supervisors.map((s) => [s.id, s.full_name]));
  for (const p of data.people.values()) sup.set(p.id, p.full_name);
  const name = (m: Map<string, string>, id: string | null) => (id ? m.get(id) ?? "" : "");
  const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : null);

  if (vista === "trilhas") {
    const rows = byTrack(data.rows, data.tracks, data.activity, today, f.parado);
    return {
      name: "Trilhas",
      columns: [
        { header: "Trilha", kind: "text", width: 36 },
        { header: "Obrigatória", kind: "text", width: 12 },
        { header: "Matrículas", kind: "number", width: 12 },
        { header: "Não iniciadas", kind: "number", width: 14 },
        { header: "Em andamento", kind: "number", width: 14 },
        { header: "Concluídas", kind: "number", width: 12 },
        { header: "Em atraso", kind: "number", width: 11 },
        { header: `Sem estudo há ${f.parado}+ dias`, kind: "number", width: 20 },
        { header: "Conclusão média", kind: "percent", width: 16 },
      ],
      rows: rows.map((r) => [r.track.name, r.track.is_mandatory ? "Sim" : "Não", r.matriculas, r.naoIniciadas, r.emAndamento, r.concluidas, r.atrasadas, r.paradas, r.media / 100]),
    };
  }

  if (vista === "atencao") {
    const rows = attention(data.rows, data.people, data.tracks, data.activity, today, f.parado);
    return {
      name: "Atenção",
      columns: [
        { header: "Colaborador", kind: "text", width: 30 },
        { header: "E-mail", kind: "text", width: 32 },
        { header: "Supervisor", kind: "text", width: 26 },
        { header: "Trilha", kind: "text", width: 32 },
        { header: "Situação", kind: "text", width: 14 },
        { header: "Progresso", kind: "percent", width: 11 },
        { header: "Prazo", kind: "date", width: 12 },
        { header: "Último estudo na trilha", kind: "date", width: 22 },
        { header: "Dias sem estudo", kind: "number", width: 16 },
        { header: "Motivo", kind: "text", width: 30 },
      ],
      rows: rows.map((r) => [
        r.person.full_name,
        r.person.email,
        name(sup, r.person.supervisor_id),
        r.track.name,
        SITUACAO_LABEL[situacaoOf(r.enrollment, today)],
        Number(r.enrollment.progress_percent) / 100,
        r.enrollment.due_date,
        day(r.ultimaAtividade),
        r.diasSemAtividade,
        [r.atrasada && "Prazo vencido", r.parada && `Sem estudo há ${r.diasSemAtividade} dias`].filter(Boolean).join("; "),
      ]),
    };
  }

  const rows = byPerson(data.rows, data.people, data.tracks, data.activity, data.seconds, data.lastByPerson, today, f.parado);
  return {
    name: "Pessoas",
    columns: [
      { header: "Colaborador", kind: "text", width: 30 },
      { header: "E-mail", kind: "text", width: 32 },
      { header: "Área", kind: "text", width: 18 },
      { header: "Cargo", kind: "text", width: 22 },
      { header: "Nível", kind: "text", width: 12 },
      { header: "Supervisor", kind: "text", width: 26 },
      { header: "Admissão", kind: "date", width: 12 },
      { header: "Trilhas", kind: "text", width: 44 },
      { header: "Conclusão média", kind: "percent", width: 16 },
      { header: "Trilhas concluídas", kind: "number", width: 18 },
      { header: "Em atraso", kind: "number", width: 11 },
      { header: `Sem estudo há ${f.parado}+ dias`, kind: "number", width: 20 },
      { header: "Próximo prazo", kind: "date", width: 14 },
      { header: "Último estudo", kind: "date", width: 14 },
      { header: "Dias sem estudo", kind: "number", width: 16 },
      { header: "Tempo de estudo (min)", kind: "number", width: 20 },
    ],
    rows: rows.map((r) => [
      r.person.full_name,
      r.person.email,
      name(area, r.person.area_id),
      name(cargo, r.person.position_id),
      name(nivel, r.person.level_id),
      name(sup, r.person.supervisor_id),
      r.person.admission_date,
      r.trilhas.map((t) => `${t.name} (${t.percent}%)`).join("; "),
      r.percent / 100,
      r.concluidas,
      r.atrasadas,
      r.paradas,
      r.proximoPrazo,
      day(r.ultimaAtividade),
      daysSince(r.ultimaAtividade, today),
      Math.round(r.segundos / 60),
    ]),
  };
}

/** CSV para o Excel em português: separador ";", UTF-8 com BOM, datas dd/mm/aaaa. */
export function toCsv(sheet: Sheet): string {
  const cell = (v: string | number | null, kind: Kind) => {
    if (v === null || v === undefined || v === "") return "";
    let s: string;
    if (kind === "date" && typeof v === "string") s = `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}`;
    else if (kind === "percent" && typeof v === "number") s = `${Math.round(v * 100)}%`;
    else s = String(v);
    // Evita que o Excel interprete texto como fórmula.
    if (/^[=+\-@]/.test(s) && kind === "text") s = `'${s}`;
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [sheet.columns.map((c) => cell(c.header, "text")).join(";")];
  for (const row of sheet.rows) lines.push(row.map((v, i) => cell(v, sheet.columns.at(i)?.kind ?? "text")).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Planilha Excel com cabeçalho fixo, filtro e formatos de data e porcentagem. */
export async function toXlsx(sheet: Sheet, title: string): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Onboarding Implantta";
  wb.created = new Date();
  const ws = wb.addWorksheet(sheet.name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = sheet.columns.map((c) => ({
    header: c.header,
    width: c.width,
    style: c.kind === "date" ? { numFmt: "dd/mm/yyyy" } : c.kind === "percent" ? { numFmt: "0%" } : {},
  }));
  for (const row of sheet.rows) {
    ws.addRow(
      row.map((v, i) => {
        const kind = sheet.columns.at(i)?.kind;
        if (kind === "date" && typeof v === "string") return new Date(`${v}T12:00:00Z`);
        return v ?? null;
      }),
    );
  }
  const head = ws.getRow(1);
  head.font = { bold: true };
  head.alignment = { vertical: "middle" };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE9EFF7" } };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
  wb.title = title;
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
