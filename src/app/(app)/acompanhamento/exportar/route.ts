import { NextResponse, type NextRequest } from "next/server";
import { parseFilters } from "@/lib/acompanhamento";
import { getCurrentUser } from "@/lib/auth";
import { todayBR } from "@/lib/learning";
import { P } from "@/lib/permissions";
import { loadStructure, loadSupervisorOptions } from "@/lib/queries";
import { buildSheet, parseVista, toCsv, toXlsx } from "../export";
import { loadAcompanhamento } from "../load";

export const dynamic = "force-dynamic";

/** Exporta a visão atual do Acompanhamento (com os filtros da tela) em CSV ou Excel. */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me?.profile || me.profile.status === "inativo") return new NextResponse("Sessão expirada. Entre novamente.", { status: 401 });
  if (!me.permissions.has(P.progressoVer) && !me.permissions.has(P.equipeVer)) {
    return new NextResponse("Você não tem permissão para exportar o acompanhamento.", { status: 403 });
  }

  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const f = parseFilters(sp);
  const vista = parseVista(sp.vista);
  const today = todayBR();
  const [data, structure, supervisors] = await Promise.all([
    loadAcompanhamento(me, f, today),
    loadStructure(),
    me.permissions.has(P.progressoVer) ? loadSupervisorOptions() : Promise.resolve([]),
  ]);
  const sheet = buildSheet(vista, data, structure, supervisors, f, today);
  const base = `acompanhamento-${vista}-${today}`;
  const headers = { "Cache-Control": "no-store" };

  if (sp.formato === "xlsx") {
    const body = await toXlsx(sheet, `Acompanhamento — ${sheet.name}`);
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
