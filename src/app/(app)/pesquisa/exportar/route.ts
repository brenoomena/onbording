import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { filterComments, parseFeedbackFilters } from "@/lib/feedback";
import { todayBR } from "@/lib/learning";
import { P } from "@/lib/permissions";
import { toCsv, toXlsx } from "../../acompanhamento/export";
import { buildFeedbackSheet } from "../export";
import { loadFeedbackReport, parsePesquisaVista } from "../load";

export const dynamic = "force-dynamic";

/** Exporta a visão atual da pesquisa de satisfação (com os filtros da tela) em CSV ou Excel. */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me?.profile || me.profile.status === "inativo") return new NextResponse("Sessão expirada. Entre novamente.", { status: 401 });
  if (!me.permissions.has(P.pesquisaVer)) return new NextResponse("Você não tem permissão para exportar a pesquisa de satisfação.", { status: 403 });

  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const today = todayBR();
  const f = parseFeedbackFilters(sp, today);
  const vista = parsePesquisaVista(sp.vista);
  const { report, error } = await loadFeedbackReport(f);
  if (error) return new NextResponse("Não foi possível gerar o relatório.", { status: 500 });
  const sheet = buildFeedbackSheet(vista, report, filterComments(report.comments, sp));
  const base = `pesquisa-${vista}-${today}`;
  const headers = { "Cache-Control": "no-store" };

  if (sp.formato === "xlsx") {
    const body = await toXlsx(sheet, `Pesquisa de satisfação — ${sheet.name}`);
    return new NextResponse(body, {
      headers: {
        ...headers,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${base}.xlsx"`,
      },
    });
  }
  return new NextResponse(toCsv(sheet), {
    headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.csv"` },
  });
}
