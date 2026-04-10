import { getAuth0Client } from "@/lib/auth0";

export async function AuthHeader() {
  const auth0 = getAuth0Client();
  const session = await auth0.getSession();
  const user = session?.user;

  return (
    <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 text-slate-100">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">
            OWE
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Authenticated business energy intake workspace
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-white">
              {user?.name ?? user?.nickname ?? "Signed in"}
            </p>
            <p className="text-xs text-slate-400">{user?.email ?? "Authenticated user"}</p>
          </div>
          <a
            className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
            href="/auth/logout"
          >
            Log out
          </a>
        </div>
      </div>
    </header>
  );
}
