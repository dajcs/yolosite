import { auth } from "@/auth";

export async function sessionOk(): Promise<boolean> {
  const session = await auth();
  return Boolean(session);
}

export function skillOk(req: Request): boolean {
  const header = req.headers.get("authorization") ?? "";
  const token = process.env.SKILL_API_TOKEN;
  return Boolean(token) && header === `Bearer ${token}`;
}
