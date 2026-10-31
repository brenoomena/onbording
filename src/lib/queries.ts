import { createClient } from "@/lib/supabase/server";
import type { Area, Level, Position, Role, UserStatus } from "@/lib/types";

export interface PositionWithLevels extends Position {
  level_ids: string[];
}

export interface Structure {
  areas: Area[];
  levels: Level[];
  positions: PositionWithLevels[];
  roles: Role[];
}

/** Áreas, cargos (com níveis permitidos), níveis e perfis, para formulários e filtros. */
export async function loadStructure(): Promise<Structure> {
  const supabase = await createClient();
  const [areas, levels, positions, roles] = await Promise.all([
    supabase.from("areas").select("id, name, description, active").order("name"),
    supabase.from("levels").select("id, name, rank, description, active").order("rank"),
    supabase.from("positions").select("id, name, area_id, description, active, position_levels(level_id)").order("name"),
    supabase.from("roles").select("id, key, name, description, is_system").order("name"),
  ]);
  return {
    areas: (areas.data ?? []) as Area[],
    levels: (levels.data ?? []) as Level[],
    positions: ((positions.data ?? []) as Array<Position & { position_levels: { level_id: string }[] }>).map(
      ({ position_levels, ...p }) => ({ ...p, level_ids: position_levels.map((l) => l.level_id) }),
    ),
    roles: (roles.data ?? []) as Role[],
  };
}

export interface PersonOption {
  id: string;
  full_name: string;
}

/** Pessoas que podem ser supervisoras: perfis Supervisor e Administrador, não inativas. */
export async function loadSupervisorOptions(): Promise<PersonOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, status, role:roles!inner(key)")
    .in("role.key", ["supervisor", "admin"])
    .neq("status", "inativo")
    .order("full_name");
  return ((data ?? []) as Array<{ id: string; full_name: string }>).map(({ id, full_name }) => ({ id, full_name }));
}

export interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  status: UserStatus;
  admission_date: string | null;
  onboarding_start_date: string | null;
  last_access_at: string | null;
  created_at: string;
  role_id: string;
  area_id: string | null;
  position_id: string | null;
  level_id: string | null;
  supervisor_id: string | null;
  avatar_path: string | null;
  role: { key: string; name: string } | null;
  area: { name: string } | null;
  position: { name: string } | null;
  level: { name: string } | null;
  supervisor: { full_name: string } | null;
}

export const PROFILE_SELECT =
  "id, full_name, email, avatar_path, status, admission_date, onboarding_start_date, last_access_at, created_at, role_id, area_id, position_id, level_id, supervisor_id, role:roles(key, name), area:areas(name), position:positions(name), level:levels(name), supervisor:supervisor_id(full_name)";
