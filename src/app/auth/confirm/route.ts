import { NextResponse, type NextRequest } from "next/server";

/** Links antigos de convite e de senha: o acesso agora é só com Google. */
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/login", request.url));
}
