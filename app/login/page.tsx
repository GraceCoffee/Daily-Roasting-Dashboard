type SearchParams = Promise<{ from?: string; error?: string }>;

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  return (
    <main className="mx-auto max-w-md px-6 pt-12 pb-24">
      <h1 className="text-2xl font-semibold tracking-tight">
        Grace Coffee — Roasting Dashboard
      </h1>
      <p className="mt-1 text-sm text-stone-600">
        Enter the shared team password to continue.
      </p>
      <form method="POST" action="/api/login" className="mt-6 space-y-4">
        {params.from ? (
          <input type="hidden" name="from" value={params.from} />
        ) : null}
        <label className="block">
          <span className="block text-sm font-medium text-stone-700">
            Password
          </span>
          <input
            type="password"
            name="password"
            required
            autoFocus
            autoComplete="current-password"
            className="mt-1 block w-full rounded border border-stone-300 px-3 py-2 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
          />
        </label>
        {params.error ? (
          <p className="text-sm text-red-600">Incorrect password.</p>
        ) : null}
        <button
          type="submit"
          className="w-full rounded bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
