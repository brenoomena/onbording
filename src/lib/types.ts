export type UserStatus = "onboarding" | "ativo" | "inativo";

export interface Area {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
}

export interface Level {
  id: string;
  name: string;
  rank: number;
  description: string | null;
  active: boolean;
}

export interface Position {
  id: string;
  name: string;
  area_id: string;
  description: string | null;
  active: boolean;
}

export interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

export interface Permission {
  key: string;
  module: string;
  name: string;
  description: string | null;
  sort_order: number;
}

export interface Profile {
  id: string;
  full_name: string;
  avatar_path: string | null;
  email: string;
  role_id: string;
  area_id: string | null;
  position_id: string | null;
  level_id: string | null;
  supervisor_id: string | null;
  admission_date: string | null;
  onboarding_start_date: string | null;
  status: UserStatus;
  last_access_at: string | null;
  created_at: string;
}

export const STATUS_LABEL: Record<UserStatus, string> = {
  onboarding: "Em onboarding",
  ativo: "Ativo",
  inativo: "Inativo",
};
