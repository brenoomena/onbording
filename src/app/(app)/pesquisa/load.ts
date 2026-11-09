import "server-only";
import { normalizeReport, type FeedbackFilters, type FeedbackReport } from "@/lib/feedback";
import { createClient } from "@/lib/supabase/server";

export type PesquisaVista = "trilhas" | "conteudos" | "comentarios";

export function parsePesquisaVista(v: unknown): PesquisaVista {
  return v === "conteudos" || v === "comentarios" ? v : "trilhas";
}

export async function loadFeedbackReport(f: FeedbackFilters): Promise<{ report: FeedbackReport; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("feedback_report", { p_from: f.from, p_to: f.to, p_area: f.area });
  if (error) return { report: normalizeReport(null), error: error.message };
  return { report: normalizeReport(data) };
}
