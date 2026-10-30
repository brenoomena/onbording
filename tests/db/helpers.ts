import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";

/**
 * Banco de testes descartável.
 *
 * TEST_DATABASE_URL aponta para um Postgres 15+ onde o usuário pode
 * criar bancos (ex.: postgres://postgres@localhost:54329/postgres).
 * Cada arquivo de teste cria um banco novo, aplica o stub do Supabase e
 * todas as migrações, e apaga o banco no final.
 */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const root = join(__dirname, "..", "..");
const migrationsDir = join(root, "supabase", "migrations");

export function migrationFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => join(migrationsDir, f));
}

export interface TestDb {
  pool: pg.Pool;
  name: string;
  drop: () => Promise<void>;
}

export async function createTestDb(): Promise<TestDb> {
  if (!TEST_DATABASE_URL) throw new Error("Defina TEST_DATABASE_URL para rodar os testes de banco.");
  const name = `onb_test_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const admin = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();

  const url = new URL(TEST_DATABASE_URL);
  url.pathname = `/${name}`;
  const pool = new pg.Pool({ connectionString: url.toString(), max: 4 });

  const setup = await pool.connect();
  try {
    await setup.query(readFileSync(join(__dirname, "supabase-stub.sql"), "utf8"));
    for (const file of migrationFiles()) {
      await setup.query(readFileSync(file, "utf8"));
    }
  } finally {
    setup.release();
  }

  return {
    pool,
    name,
    drop: async () => {
      await pool.end();
      const c = new pg.Client({ connectionString: TEST_DATABASE_URL });
      await c.connect();
      await c.query(`drop database if exists ${name} with (force)`);
      await c.end();
    },
  };
}

/** Executa como o usuário autenticado `uid`, com RLS valendo. */
export async function asUser<T>(
  pool: pg.Pool,
  uid: string | null,
  fn: (q: (sql: string, params?: unknown[]) => Promise<pg.QueryResult>) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    if (uid) {
      await client.query("set local role authenticated");
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: uid, role: "authenticated" }),
      ]);
    } else {
      await client.query("set local role anon");
      await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "anon" })]);
    }
    const result = await fn((sql, params) => client.query(sql, params));
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

/** Executa como superusuário (equivale ao SQL editor / migrações). */
export async function asSystem<T>(
  pool: pg.Pool,
  fn: (q: (sql: string, params?: unknown[]) => Promise<pg.QueryResult>) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn((sql, params) => client.query(sql, params));
  } finally {
    client.release();
  }
}

export async function createPerson(
  pool: pg.Pool,
  opts: {
    name: string;
    email: string;
    role: "admin" | "supervisor" | "colaborador" | string;
    area?: string;
    supervisorId?: string | null;
    status?: "onboarding" | "ativo" | "inativo";
  },
): Promise<string> {
  return asSystem(pool, async (q) => {
    const { rows } = await q("insert into auth.users (email) values ($1) returning id", [opts.email]);
    const id = rows[0].id as string;
    await q(
      `insert into public.profiles (id, full_name, email, role_id, area_id, supervisor_id, status)
       values ($1, $2, $3,
         (select id from public.roles where key = $4),
         (select id from public.areas where name = $5),
         $6, $7)`,
      [id, opts.name, opts.email, opts.role, opts.area ?? null, opts.supervisorId ?? null, opts.status ?? "ativo"],
    );
    return id;
  });
}
