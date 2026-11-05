import { redirect } from "next/navigation";

/** A plataforma entra só com Google: telas antigas de senha levam ao login. */
export default function Page() {
  redirect("/login");
}
