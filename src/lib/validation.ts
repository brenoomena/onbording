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
  description: optionalText(300),
});

export const levelSchema = z.object({
  name: z.string({ error: "Informe o nome." }).min(2, "O nome precisa de pelo menos 2 caracteres.").max(60),
  description: optionalText(300),
});

export const positionSchema = z.object({
  name: z.string({ error: "Informe o nome." }).min(2, "O nome precisa de pelo menos 2 caracteres.").max(80),
  area_id: z.uuid("Selecione a área."),
  description: optionalText(300),
});

export const roleSchema = z.object({
  name: z.string({ error: "Informe o nome." }).min(2, "O nome precisa de pelo menos 2 caracteres.").max(60),
  description: optionalText(300),
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
