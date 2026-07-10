import { db } from "./db";

export async function getState(key: string): Promise<string | null> {
  const rows = await db()`SELECT value FROM app_state WHERE key = ${key}`;
  return rows.length ? (rows[0] as { value: string }).value : null;
}

export async function setState(key: string, value: string): Promise<void> {
  await db()`
    INSERT INTO app_state (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}
