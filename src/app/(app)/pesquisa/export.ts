import "server-only";
import { todaySP } from "@/lib/checklist";
import { KIND_LABEL } from "@/lib/learning";
import { responseRate, type FeedbackComment, type FeedbackReport } from "@/lib/feedback";
import type { Sheet } from "../acompanhamento/export";
import type { PesquisaVista } from "./load";

const dist = (d: number[]) => [...d];

/** Planilha da visão atual da pesquisa, com os filtros aplicados. */
export function buildFeedbackSheet(vista: PesquisaVista, r: FeedbackReport, comments: FeedbackComment[]): Sheet {
  if (vista === "conteudos") {
    return {
      name: "Conteúdos",
      columns: [
        { header: "Conteúdo", kind: "text", width: 44 },
        { header: "Tipo", kind: "text", width: 14 },
        { header: "Nota média", kind: "number", width: 12 },
        { header: "Avaliações", kind: "number", width: 12 },
        { header: "1 estrela", kind: "number", width: 10 },
        { header: "2 estrelas", kind: "number", width: 10 },
        { header: "3 estrelas", kind: "number", width: 10 },
        { header: "4 estrelas", kind: "number", width: 10 },
        { header: "5 estrelas", kind: "number", width: 10 },
        { header: "Comentários", kind: "number", width: 12 },
      ],
      rows: r.contents.map((c) => [c.title, KIND_LABEL[c.kind as keyof typeof KIND_LABEL] ?? c.kind, c.avg, c.responses, ...dist(c.dist), c.comments]),
    };
  }
  if (vista === "comentarios") {
    return {
      name: "Comentários",
      columns: [
        { header: "Data", kind: "date", width: 14 },
        { header: "Tipo", kind: "text", width: 10 },
        { header: "Trilha ou conteúdo", kind: "text", width: 40 },
        { header: "Nota", kind: "number", width: 8 },
        { header: "Comentário", kind: "text", width: 70 },
        { header: "Pessoa", kind: "text", width: 28 },
        { header: "Área", kind: "text", width: 20 },
      ],
      rows: comments.map((c) => [
        todaySP(new Date(c.at)),
        c.kind === "trilha" ? "Trilha" : "Conteúdo",
        c.item,
        c.rating,
        c.comment,
        c.author ?? "Anônimo",
        c.author ? (c.area ?? "") : "",
      ]),
    };
  }
  return {
    name: "Trilhas",
    columns: [
      { header: "Trilha", kind: "text", width: 44 },
      { header: "Nota média", kind: "number", width: 12 },
      { header: "Avaliações", kind: "number", width: 12 },
      { header: "Conclusões", kind: "number", width: 12 },
      { header: "Taxa de resposta", kind: "percent", width: 16 },
      { header: "1 estrela", kind: "number", width: 10 },
      { header: "2 estrelas", kind: "number", width: 10 },
      { header: "3 estrelas", kind: "number", width: 10 },
      { header: "4 estrelas", kind: "number", width: 10 },
      { header: "5 estrelas", kind: "number", width: 10 },
      { header: "Comentários", kind: "number", width: 12 },
    ],
    rows: r.tracks.map((t) => [t.name, t.avg, t.responses, t.completions, t.completions ? (responseRate(t.responses, t.completions) ?? 0) / 100 : null, ...dist(t.dist), t.comments]),
  };
}
