import { auth } from "@/auth";

export async function sessionOk(): Promise<boolean> {
  const session = await auth();
  return Boolean(session);
}
