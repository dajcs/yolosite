import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/auth";

export const metadata = { title: "Assistant — Attila Nemet" };

export default async function AssistantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/api/auth/signin?callbackUrl=/assistant");

  return (
    <div className="min-h-screen bg-bg text-text">
      <nav className="flex items-center gap-5 border-b border-surface2 px-4 py-3 text-sm">
        <span className="font-bold text-yellow">Job Assistant</span>
        <Link href="/assistant" className="text-blue hover:underline">
          Offers
        </Link>
        <Link href="/assistant/applications" className="text-blue hover:underline">
          Applications
        </Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
          className="ml-auto"
        >
          <button type="submit" className="text-gray hover:text-text">
            Sign out
          </button>
        </form>
      </nav>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
