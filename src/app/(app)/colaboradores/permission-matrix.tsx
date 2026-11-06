"use client";

import { Check, Lock, RotateCcw, Unlock } from "lucide-react";
import { useMemo, useState } from "react";
import { ActionForm, FormBar, SubmitButton } from "@/components/forms";
import { Badge, cx } from "@/components/ui";

export interface PermissionInfo {
  key: string;
  module: string;
  name: string;
  description: string | null;
}

type Choice = "padrao" | "liberar" | "bloquear";

/**
 * Permissões da pessoa por módulo e ação. Cada linha mostra o padrão do
 * perfil e permite liberar ou bloquear só para esta pessoa. O resultado
 * final ("Tem acesso") é o que o servidor e o banco aplicam.
 */
export function PermissionMatrix({
  profileId,
  roleName,
  permissions,
  roleGrants,
  overrides,
  action,
}: {
  profileId: string;
  roleName: string;
  permissions: PermissionInfo[];
  roleGrants: string[];
  overrides: Record<string, boolean>;
  action: Parameters<typeof ActionForm>[0]["action"];
}) {
  const base = useMemo(() => new Set(roleGrants), [roleGrants]);
  const [choice, setChoice] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(permissions.map((p) => [p.key, p.key in overrides ? (overrides[p.key] ? "liberar" : "bloquear") : "padrao"])),
  );
  const modules = useMemo(() => {
    const m = new Map<string, PermissionInfo[]>();
    for (const p of permissions) m.set(p.module, [...(m.get(p.module) ?? []), p]);
    return [...m.entries()];
  }, [permissions]);

  const effective = (k: string) => (choice[k] === "padrao" ? base.has(k) : choice[k] === "liberar");
  const changed = Object.values(choice).filter((c) => c !== "padrao").length;

  return (
    <ActionForm action={action}>
      <FormBar
        info={
          <span>
            Perfil base: <strong className="text-ink">{roleName}</strong> · {changed === 0 ? "sem ajustes individuais" : `${changed} ${changed === 1 ? "ajuste individual" : "ajustes individuais"}`}
          </span>
        }
      >
        {changed > 0 && (
          <button
            type="button"
            onClick={() => setChoice(Object.fromEntries(permissions.map((p) => [p.key, "padrao" as Choice])))}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted hover:bg-sunken hover:text-ink"
          >
            <RotateCcw size={15} aria-hidden /> Voltar ao padrão do perfil
          </button>
        )}
        <SubmitButton>Salvar permissões</SubmitButton>
      </FormBar>
      <input type="hidden" name="profile_id" value={profileId} />

      <div className="grid gap-4 lg:grid-cols-2">
        {modules.map(([module, list]) => (
          <fieldset key={module} className="rounded-xl border border-line">
            <legend className="sr-only">{module}</legend>
            <p className="border-b border-line bg-sunken/50 px-4 py-2.5 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-muted" aria-hidden>
              {module}
            </p>
            <ul className="divide-y divide-line">
              {list.map((p) => {
                const on = effective(p.key);
                return (
                  <li key={p.key} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <input type="hidden" name={`perm:${p.key}`} value={choice[p.key]} />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium">
                        {p.name}
                        {on ? <Badge tag="permissao.tem_acesso">Tem acesso</Badge> : <Badge tag="permissao.sem_acesso">Sem acesso</Badge>}
                      </p>
                      <p className="text-[12px] text-muted">
                        {p.description}
                        <span className="ml-1 whitespace-nowrap">· Perfil: {base.has(p.key) ? "permite" : "não permite"}</span>
                      </p>
                    </div>
                    <div role="radiogroup" aria-label={`Ajuste para ${p.name}`} className="inline-flex rounded-lg border border-line p-0.5">
                      {(
                        [
                          ["padrao", "Padrão", Check],
                          ["liberar", "Liberar", Unlock],
                          ["bloquear", "Bloquear", Lock],
                        ] as const
                      ).map(([value, label, Icon]) => (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={choice[p.key] === value}
                          onClick={() => setChoice((c) => ({ ...c, [p.key]: value }))}
                          className={cx(
                            "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
                            choice[p.key] === value
                              ? value === "liberar"
                                ? "bg-ok-soft text-ok"
                                : value === "bloquear"
                                  ? "bg-danger-soft text-danger"
                                  : "bg-sunken text-ink"
                              : "text-muted hover:text-ink",
                          )}
                        >
                          <Icon size={13} aria-hidden /> {label}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}
      </div>
    </ActionForm>
  );
}
