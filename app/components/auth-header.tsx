"use client";

import { useEffect, useState } from "react";

type AuthUser = {
  name?: string | null;
  email?: string | null;
  nickname?: string | null;
};

export function AuthHeader() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        const response = await fetch("/api/me", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { user?: AuthUser };
        if (!cancelled) {
          setUser(payload.user ?? null);
        }
      } catch {
        // Keep the header stable even if the auth profile request fails.
      }
    }

    void loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

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
              {user?.name ?? user?.nickname ?? "Authenticated user"}
            </p>
            <p className="text-xs text-slate-400">{user?.email ?? "Signed in"}</p>
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
