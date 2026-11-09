import { describe, expect, it } from "vitest";
import { cleanComment, distPercent, filterComments, formatAvg, normalizeReport, parseFeedbackFilters, parseRating, responseRate, type FeedbackComment } from "@/lib/feedback";

describe("pesquisa de satisfação", () => {
  it("nota só de 1 a 5, inteira", () => {
    expect(parseRating("4")).toBe(4);
    expect(parseRating(5)).toBe(5);
    for (const v of ["0", "6", "3.5", "", null, "abc"]) expect(parseRating(v)).toBeNull();
  });

  it("comentário: apara, vazio vira null e respeita o limite", () => {
    expect(cleanComment("  Ótima  ", 10)).toEqual({ value: "Ótima" });
    expect(cleanComment("   ", 10)).toEqual({ value: null });
    expect(cleanComment(null, 10)).toEqual({ value: null });
    expect(cleanComment("x".repeat(1001), 1000).error).toMatch(/1\.000 caracteres/);
  });

  it("taxa de resposta e distribuição", () => {
    expect(responseRate(2, 3)).toBe(67);
    expect(responseRate(0, 0)).toBeNull();
    expect(responseRate(5, 3)).toBe(100);
    expect(distPercent([0, 1, 0, 1, 0])).toEqual([0, 50, 0, 50, 0]);
    expect(distPercent([0, 0, 0, 0, 0])).toEqual([0, 0, 0, 0, 0]);
    expect(formatAvg(4.333)).toBe("4,3");
    expect(formatAvg(3)).toBe("3,0");
    expect(formatAvg(null)).toBe("—");
  });

  it("filtros: padrão 90 dias, atalhos, datas e área", () => {
    const today = "2026-11-09";
    expect(parseFeedbackFilters({}, today)).toEqual({ from: "2026-08-12", to: today, area: null, periodo: "90" });
    expect(parseFeedbackFilters({ periodo: "30" }, today)).toMatchObject({ from: "2026-10-11", to: today });
    expect(parseFeedbackFilters({ periodo: "tudo" }, today)).toMatchObject({ from: null, to: null });
    expect(parseFeedbackFilters({ periodo: "personalizado", de: "2026-10-31", ate: "2026-10-01" }, today)).toMatchObject({ from: "2026-10-01", to: "2026-10-31" });
    expect(parseFeedbackFilters({ de: "2026-01-01" }, today)).toMatchObject({ from: "2026-01-01", to: null, periodo: "personalizado" });
    expect(parseFeedbackFilters({ periodo: "personalizado", de: "lixo" }, today)).toMatchObject({ from: null, to: null });
    expect(parseFeedbackFilters({ area: "x' or 1=1" }, today).area).toBeNull();
    const id = "6f1d2c3b-1111-4222-8333-944455556666";
    expect(parseFeedbackFilters({ area: id }, today).area).toBe(id);
  });

  it("normaliza o JSON do banco (texto vira número; vazio vira zeros)", () => {
    const r = normalizeReport({ summary: { track_responses: "2", track_avg: "3.50", track_dist: [0, 1, "0", 1] }, tracks: [{ id: "t", name: "T", completions: "3", responses: "2", avg: null, dist: null, comments: "1" }] });
    expect(r.summary).toMatchObject({ track_responses: 2, track_avg: 3.5, track_dist: [0, 1, 0, 1, 0], completions: 0, content_avg: null });
    expect(r.tracks[0]).toMatchObject({ completions: 3, responses: 2, avg: null, dist: [0, 0, 0, 0, 0], comments: 1 });
    expect(normalizeReport(null)).toMatchObject({ tracks: [], contents: [], comments: [] });
  });

  it("filtra comentários por nota, tipo e item", () => {
    const c = (kind: "trilha" | "conteudo", item_id: string, rating: number): FeedbackComment => ({ kind, item_id, item: item_id, rating, comment: "x", at: "2026-11-09T10:00:00Z", author: null, area: null });
    const list = [c("trilha", "a", 5), c("conteudo", "b", 2), c("trilha", "a", 2)];
    expect(filterComments(list, {})).toHaveLength(3);
    expect(filterComments(list, { nota: "2" })).toHaveLength(2);
    expect(filterComments(list, { nota: "9" })).toHaveLength(3);
    expect(filterComments(list, { tipo: "conteudo" })).toHaveLength(1);
    expect(filterComments(list, { item: "a", nota: "2" })).toHaveLength(1);
  });
});
