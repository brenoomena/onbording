"use client";

import { useState } from "react";
import { Button, Select } from "@/components/ui";
import type { AudienceRule } from "@/lib/learning";
import type { Structure } from "@/lib/queries";

/**
 * Editor de público-alvo. Cada linha combina área, cargo e nível;
 * campo vazio vale para todos. Envia campos rule_area/rule_position/rule_level.
 */
export function AudienceEditor({
  structure,
  initial,
  emptyHint,
}: {
  structure: Structure;
  initial: AudienceRule[];
  emptyHint: string;
}) {
  const [rules, setRules] = useState<AudienceRule[]>(initial);
  const update = (i: number, patch: Partial<AudienceRule>) =>
    setRules((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="grid gap-2">
      {rules.length === 0 && <p className="rounded-lg border border-dashed border-line px-3 py-2.5 text-[13px] text-muted">{emptyHint}</p>}
      {rules.map((r, i) => {
        const positions = structure.positions.filter((p) => !r.area_id || p.area_id === r.area_id);
        return (
          <div key={i} className="grid gap-2 rounded-lg border border-line p-2.5 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center">
            <Select aria-label="Área" name="rule_area" value={r.area_id ?? ""} onChange={(e) => update(i, { area_id: e.target.value || null, position_id: null })}>
              <option value="">Todas as áreas</option>
              {structure.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
            <Select aria-label="Cargo" name="rule_position" value={r.position_id ?? ""} onChange={(e) => update(i, { position_id: e.target.value || null })}>
              <option value="">Todos os cargos</option>
              {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Select aria-label="Nível" name="rule_level" value={r.level_id ?? ""} onChange={(e) => update(i, { level_id: e.target.value || null })}>
              <option value="">Todos os níveis</option>
              {structure.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
            <Button type="button" variant="ghost" className="py-1.5 text-[13px]" onClick={() => setRules((rs) => rs.filter((_, j) => j !== i))}>
              Remover
            </Button>
          </div>
        );
      })}
      <div>
        <Button
          type="button"
          variant="secondary"
          className="py-1.5 text-[13px]"
          onClick={() => setRules((rs) => [...rs, { area_id: null, position_id: null, level_id: null }])}
        >
          Adicionar público
        </Button>
      </div>
    </div>
  );
}
