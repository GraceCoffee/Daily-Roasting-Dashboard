"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {error ? (
        <span className="text-xs text-red-600" role="alert">
          {error}
        </span>
      ) : null}
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const res = await fetch("/api/refresh", {
                method: "GET",
                cache: "no-store",
              });
              if (!res.ok) {
                const body = (await res.json().catch(() => ({}))) as {
                  error?: string;
                };
                setError(body.error ?? `Refresh failed (HTTP ${res.status})`);
                return;
              }
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            }
          });
        }}
        className="rounded border border-grace-blue px-3 py-1 text-sm font-medium text-grace-blue hover:bg-grace-blue hover:text-white disabled:cursor-wait disabled:opacity-60"
      >
        {isPending ? "Refreshing…" : "Refresh now"}
      </button>
    </div>
  );
}
