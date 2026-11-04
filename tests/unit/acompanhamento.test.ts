import { describe, expect, it } from "vitest";
import {
  applyFilters,
  attention,
  byPerson,
  byTrack,
  daysSince,
  formatDuration,
  funnel,
  isParada,
  parseFilters,
  situacaoOf,
  summarize,
  type EnrollmentRow,
  type PersonInfo,
  type TrackInfo,
} from "@/lib/acompanhamento";

const TODAY = "2026-11-04";
const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "aaaaaaaa-0000-0000-0000-000000000002";
const T1 = "bbbbbbbb-0000-0000-0000-000000000001";
const T2 = "bbbbbbbb-0000-0000-0000-000000000002";
const AREA = "cccccccc-0000-0000-0000-000000000001";

const person = (id: string, name: string, extra: Partial<PersonInfo> = {}): PersonInfo => ({
  id,
  full_name: name,
  email: `${name.toLowerCase()}@x.com`,
  status: "ativo",
  area_id: null,
  position_id: null,
  level_id: null,
  supervisor_id: null,
  admission_date: null,
  last_access_at: null,
  ...extra,
});
const enr = (id: string, profile: string, track: string, extra: Partial<EnrollmentRow> = {}): EnrollmentRow => ({
  id,
  profile_id: profile,
  track_id: track,
  status: "em_andamento",
  progress_percent: 50,
  due_date: null,
  assigned_at: "2026-10-01T10:00:00Z",
  started_at: null,
  completed_at: null,
  ...extra,
});

const people = new Map([
  [A, person(A, "Ana", { area_id: AREA, admission_date: "2026-09-01" })],
  [B, person(B, "Bruno", { admission_date: "2026-10-20" })],
]);
const tracks = new Map<string, TrackInfo>([
  [T1, { id: T1, name: "Comercial", status: "publicado", is_mandatory: true }],
  [T2, { id: T2, name: "Produtos", status: "publicado", is_mandatory: false }],
]);
const rows = [
  enr("e1", A, T1, { due_date: "2026-11-01", progress_percent: 40 }), // atrasada
  enr("e2", A, T2, { status: "concluida", progress_percent: 100, due_date: "2026-10-01" }), // concluída: não atrasa
  enr("e3", B, T1, { status: "nao_iniciada", progress_percent: 0, assigned_at: "2026-11-01T10:00:00Z" }),
  enr("e4", B, T2, { progress_percent: 30, due_date: "2026-12-01" }),
];
const activity = new Map([
  [`${A}|${T1}`, "2026-11-03T15:00:00Z"],
  [`${B}|${T2}`, "2026-10-10T15:00:00Z"],
]);

describe("acompanhamento", () => {
  it("situação: atrasada só quando o prazo venceu e não concluiu", () => {
    expect(situacaoOf(rows[0], TODAY)).toBe("atrasada");
    expect(situacaoOf(rows[1], TODAY)).toBe("concluida");
    expect(situacaoOf(enr("x", A, T1, { due_date: TODAY }), TODAY)).toBe("em_andamento");
  });

  it("dias desde e parada", () => {
    expect(daysSince("2026-10-31T23:00:00Z", TODAY)).toBe(4);
    expect(daysSince(null, TODAY)).toBeNull();
    expect(isParada(rows[3], activity.get(`${B}|${T2}`) ?? null, TODAY, 15)).toBe(true); // 25 dias
    expect(isParada(rows[3], activity.get(`${B}|${T2}`) ?? null, TODAY, 30)).toBe(false);
    // Sem estudo: conta da matrícula (3 dias).
    expect(isParada(rows[2], null, TODAY, 7)).toBe(false);
    expect(isParada(rows[1], null, TODAY, 1)).toBe(false); // concluída nunca para
  });

  it("filtros por pessoa, trilha, situação e admissão", () => {
    const base = parseFilters({});
    expect(applyFilters(rows, people, { ...base, area: AREA }, TODAY).map((r) => r.id)).toEqual(["e1", "e2"]);
    expect(applyFilters(rows, people, { ...base, trilha: T2 }, TODAY).map((r) => r.id)).toEqual(["e2", "e4"]);
    expect(applyFilters(rows, people, { ...base, situacao: "atrasada" }, TODAY).map((r) => r.id)).toEqual(["e1"]);
    expect(applyFilters(rows, people, { ...base, situacao: "em_andamento" }, TODAY).map((r) => r.id)).toEqual(["e1", "e4"]);
    expect(applyFilters(rows, people, { ...base, de: "2026-10-01" }, TODAY).map((r) => r.id)).toEqual(["e3", "e4"]);
  });

  it("filtros da URL: valores inválidos são ignorados", () => {
    const f = parseFilters({ trilha: "x' or 1=1", situacao: "hackeado", de: "ontem", parado: "999", area: AREA });
    expect(f).toEqual({ trilha: undefined, area: AREA, cargo: undefined, nivel: undefined, supervisor: undefined, situacao: undefined, de: undefined, ate: undefined, parado: 15 });
    expect(parseFilters({ parado: "30", situacao: "atrasada" })).toMatchObject({ parado: 30, situacao: "atrasada" });
  });

  it("resumo bate com as contagens", () => {
    expect(summarize(rows, TODAY)).toEqual({ matriculas: 4, pessoas: 2, naoIniciadas: 1, emAndamento: 2, concluidas: 1, atrasadas: 1, media: 43 });
    expect(summarize([], TODAY).media).toBe(0);
  });

  it("por pessoa: atrasados primeiro, prazo mais próximo e tempo de estudo", () => {
    const out = byPerson(rows, people, tracks, activity, new Map([[A, 3600]]), new Map(), TODAY, 15);
    expect(out.map((r) => r.person.full_name)).toEqual(["Ana", "Bruno"]);
    expect(out[0]).toMatchObject({ percent: 70, concluidas: 1, atrasadas: 1, proximoPrazo: "2026-11-01", segundos: 3600 });
    expect(out[1]).toMatchObject({ percent: 15, atrasadas: 0, paradas: 1, proximoPrazo: "2026-12-01" });
  });

  it("por trilha e lista de atenção", () => {
    const t = byTrack(rows, tracks, activity, TODAY, 15);
    expect(t.find((r) => r.track.id === T1)).toMatchObject({ matriculas: 2, atrasadas: 1, naoIniciadas: 1, media: 20 });
    const a = attention(rows, people, tracks, activity, TODAY, 15);
    expect(a.map((r) => [r.enrollment.id, r.atrasada, r.parada])).toEqual([
      ["e1", true, false],
      ["e4", false, true],
    ]);
    expect(a[1].diasSemAtividade).toBe(25);
  });

  it("etapas: quantos concluíram cada uma", () => {
    const steps = [
      { contentId: "c1", title: "Boas-vindas", moduleTitle: "M1", required: true },
      { contentId: "c2", title: "Produtos", moduleTitle: "M2", required: true },
    ];
    const done = new Set([`${A}|c1`, `${B}|c1`, `${A}|c2`]);
    expect(funnel(steps, [A, B], done).map((s) => s.concluiram)).toEqual([2, 1]);
  });

  it("formata a duração", () => {
    expect(formatDuration(0)).toBe("—");
    expect(formatDuration(20)).toBe("1 min");
    expect(formatDuration(1500)).toBe("25 min");
    expect(formatDuration(7500)).toBe("2 h 05 min");
  });
});
