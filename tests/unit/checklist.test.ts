import { describe, expect, it } from "vitest";
import { offsetLabel, sanitizeItems, taskState } from "@/lib/checklist";

describe("checklist de integração", () => {
  it("prazo em relação à admissão", () => {
    expect(offsetLabel(0)).toBe("No dia da admissão");
    expect(offsetLabel(-3)).toBe("3 dias antes da admissão");
    expect(offsetLabel(1)).toBe("1 dia depois da admissão");
  });

  it("valida as tarefas do modelo", () => {
    expect(sanitizeItems([{ title: "  Entregar   crachá ", responsibleKind: "rh", offsetDays: "0" }]).items).toEqual([
      { title: "Entregar crachá", description: "", responsibleKind: "rh", responsibleId: "", offsetDays: 0 },
    ]);
    expect(sanitizeItems([{ title: "x" }]).error).toMatch(/Tarefa 1/);
    expect(sanitizeItems([{ title: "Criar e-mail", responsibleKind: "pessoa", responsibleId: "" }]).error).toMatch(/pessoa/);
    expect(sanitizeItems([{ title: "Longe demais", offsetDays: 400 }]).error).toMatch(/365/);
    expect(sanitizeItems([{ title: "Tipo errado", responsibleKind: "chefe" }]).items[0].responsibleKind).toBe("rh");
    expect(sanitizeItems({}).error).toBeTruthy();
  });

  it("situação da tarefa", () => {
    const today = "2026-11-10";
    expect(taskState({ done_at: "2026-11-01T10:00:00Z", due_date: "2026-11-01" }, today)).toBe("concluida");
    expect(taskState({ done_at: null, due_date: "2026-11-09" }, today)).toBe("atrasada");
    expect(taskState({ done_at: null, due_date: "2026-11-10" }, today)).toBe("hoje");
    expect(taskState({ done_at: null, due_date: "2026-11-20" }, today)).toBe("proxima");
    expect(taskState({ done_at: null, due_date: null }, today)).toBe("sem_prazo");
  });
});
