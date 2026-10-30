import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Use no máximo ${max} caracteres.`)
    .optional()
    .transform((v) => v ?? null);

const optionalId = z
  .uuid("Seleção inválida.")
  .optional()
  .transform((v) => v ?? null);

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
  .optional()
  .transform((v) => v ?? null);

export const areaSchema = z.object({
  name: z.string({ error: "Informe o nome." }).min(2, "O nome precisa de pelo menos 2 caracteres.").max(80),
  description: optionalText(600),
});

export const levelSchema = z.object({
  name: z.string({ error: "Informe o nome." }).min(2, "O nome precisa de pelo menos 2 caracteres.").max(60),
  description: optionalText(600),
});

export const positionSchema = z.object({
  name: z.string({ error: "Informe o nome." }).min(2, "O nome precisa de pelo menos 2 caracteres.").max(80),
  area_id: z.uuid("Selecione a área."),
  description: optionalText(600),
});

export const roleSchema = z.object({
  name: z.string({ error: "Informe o nome." }).min(2, "O nome precisa de pelo menos 2 caracteres.").max(60),
  description: optionalText(600),
});

export const STATUS_VALUES = ["onboarding", "ativo", "inativo"] as const;

const profileBase = {
  full_name: z
    .string({ error: "Informe o nome completo." })
    .min(3, "Informe o nome completo.")
    .max(120, "Use no máximo 120 caracteres."),
  role_id: z.uuid("Selecione o perfil de acesso."),
  area_id: optionalId,
  position_id: optionalId,
  level_id: optionalId,
  supervisor_id: optionalId,
  admission_date: optionalDate,
  onboarding_start_date: optionalDate,
  status: z.enum(STATUS_VALUES, { error: "Selecione o status." }),
};

function checkDates<T extends { admission_date: string | null; onboarding_start_date: string | null }>(
  v: T,
  ctx: z.RefinementCtx,
) {
  if (v.admission_date && v.onboarding_start_date && v.onboarding_start_date < v.admission_date) {
    ctx.addIssue({
      code: "custom",
      path: ["onboarding_start_date"],
      message: "O onboarding não pode começar antes da admissão.",
    });
  }
}

export const profileCreateSchema = z
  .object({
    ...profileBase,
    email: z.email("Informe um e-mail válido.").transform((v) => v.toLowerCase()),
  })
  .superRefine(checkDates);

export const profileUpdateSchema = z.object(profileBase).superRefine(checkDates);

export const passwordSchema = z
  .object({
    password: z
      .string({ error: "Informe a nova senha." })
      .min(10, "A senha precisa de pelo menos 10 caracteres.")
      .max(72, "Use no máximo 72 caracteres."),
    confirm: z.string({ error: "Repita a senha." }),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "As senhas não são iguais." });

/** Gera a chave técnica de um perfil a partir do nome ("Recursos Humanos" → "recursos_humanos"). */
export function roleKeyFromName(name: string): string {
  const key = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return /^[a-z]/.test(key) ? key : `perfil_${key}`.slice(0, 40);
}

// ---------------------------------------------------------------- Etapa 2

const nullableText = (max: number) =>
  z
    .string()
    .max(max, `Use no máximo ${max} caracteres.`)
    .optional()
    .transform((v) => v ?? null);

export const contentSchema = z
  .object({
    title: z.string({ error: "Informe o título." }).min(3, "O título precisa de pelo menos 3 caracteres.").max(160),
    description: nullableText(1000),
    category: nullableText(60),
    kind: z.enum(["texto", "link", "video", "arquivo"], { error: "Escolha o formato." }),
    body: nullableText(100_000),
    url: z
      .url({ protocol: /^https?$/, error: "Informe um endereço que comece com https://" })
      .optional()
      .transform((v) => v ?? null),
    storage_path: nullableText(500),
    file_name: nullableText(300),
    file_size: z.coerce.number().int().positive().optional().transform((v) => v ?? null),
    mime_type: nullableText(150),
    external_platform: nullableText(80),
    access_note: nullableText(1000),
    objective: nullableText(4000),
    estimated_minutes: z.coerce
      .number({ error: "Tempo estimado inválido." })
      .int("Use minutos inteiros.")
      .min(1, "Use pelo menos 1 minuto.")
      .max(1440, "Use no máximo 1440 minutos.")
      .optional()
      .transform((v) => v ?? null),
    owner_id: z.uuid().optional().transform((v) => v ?? null),
    status: z.enum(["rascunho", "publicado", "arquivado"]),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "texto" && !v.body) ctx.addIssue({ code: "custom", path: ["body"], message: "Escreva o texto do conteúdo." });
    if ((v.kind === "link" || v.kind === "video") && !v.url)
      ctx.addIssue({ code: "custom", path: ["url"], message: "Informe o endereço do conteúdo." });
    if (v.kind === "arquivo" && !v.storage_path)
      ctx.addIssue({ code: "custom", path: ["storage_path"], message: "Envie o arquivo." });
  });

export const trackSchema = z.object({
  name: z.string({ error: "Informe o nome." }).min(3, "O nome precisa de pelo menos 3 caracteres.").max(120),
  description: nullableText(2000),
  objective: nullableText(2000),
  audience_note: nullableText(300),
  recommended_level_id: z.uuid().optional().transform((v) => v ?? null),
  is_mandatory: z.coerce.boolean(),
  is_sequential: z.coerce.boolean(),
  deadline_days: z.coerce
    .number({ error: "Prazo inválido." })
    .int("Use dias inteiros.")
    .min(1, "Use pelo menos 1 dia.")
    .max(365, "Use no máximo 365 dias.")
    .optional()
    .transform((v) => v ?? null),
});

export const moduleSchema = z.object({
  title: z.string({ error: "Informe o nome do módulo." }).min(2, "O nome precisa de pelo menos 2 caracteres.").max(120),
  description: nullableText(1000),
});

/** Lê as regras de público do formulário (campos rule_area, rule_position, rule_level repetidos). */
export function parseAudience(fd: FormData): { area_id: string | null; position_id: string | null; level_id: string | null }[] {
  const areas = fd.getAll("rule_area").map(String);
  const positions = fd.getAll("rule_position").map(String);
  const levels = fd.getAll("rule_level").map(String);
  const isId = (v: string | undefined) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : null);
  const rules = areas.map((_, i) => ({
    area_id: isId(areas[i]),
    position_id: isId(positions[i]),
    level_id: isId(levels[i]),
  }));
  const seen = new Set<string>();
  return rules.filter((r) => {
    const k = `${r.area_id}|${r.position_id}|${r.level_id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
