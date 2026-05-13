import {
  getLatestSnapshot,
  type BlendRow,
  type ItemRow,
} from "@/lib/db";

export const dynamic = "force-dynamic";

type Snapshot = NonNullable<Awaited<ReturnType<typeof getLatestSnapshot>>>;

export default async function Home() {
  let snapshot: Snapshot | null = null;
  let dbError: string | null = null;
  try {
    snapshot = await getLatestSnapshot();
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="flex items-baseline justify-between border-b border-stone-200 pb-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Daily Roasting Dashboard
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            {snapshot ? (
              <>
                Snapshot for{" "}
                <span className="font-medium text-stone-900">
                  {snapshot.snapshotDate}
                </span>{" "}
                · generated{" "}
                <time dateTime={snapshot.payload.generatedAt}>
                  {formatGeneratedAt(snapshot.payload.generatedAt)}
                </time>
              </>
            ) : dbError ? (
              <span className="text-red-700">{dbError}</span>
            ) : (
              "No snapshot yet."
            )}
          </p>
        </div>
        <form method="POST" action="/api/logout">
          <button
            type="submit"
            className="text-sm text-stone-500 hover:text-stone-900 hover:underline"
          >
            Sign out
          </button>
        </form>
      </header>

      {!snapshot ? (
        <EmptyState />
      ) : (
        <>
          {snapshot.payload.warnings.length > 0 ? (
            <WarningBanner warnings={snapshot.payload.warnings} />
          ) : null}
          <BlendTable blends={snapshot.payload.blends} />
          <ItemTable items={snapshot.payload.items} />
        </>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="mt-12 rounded border border-dashed border-stone-300 p-8 text-center text-stone-600">
      <p className="font-medium">No snapshot has been generated yet.</p>
      <p className="mt-2 text-sm">
        The dashboard refreshes automatically each morning at 4:00am EST.
      </p>
    </div>
  );
}

function WarningBanner({ warnings }: { warnings: string[] }) {
  return (
    <section className="mt-6 rounded border border-amber-300 bg-amber-50 p-4">
      <h2 className="text-sm font-medium text-amber-900">
        Warnings ({warnings.length})
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </section>
  );
}

function BlendTable({ blends }: { blends: BlendRow[] }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold">By blend</h2>
      <p className="mt-1 text-sm text-stone-600">
        The first two columns are the action items for today; the rest are
        context from NetSuite.
      </p>
      <div className="mt-3 overflow-x-auto rounded border border-stone-200">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-100 text-stone-700">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Blend</th>
              <th className="px-4 py-2 text-right font-medium">
                How much to roast (lbs)
              </th>
              <th className="px-4 py-2 text-right font-medium">
                How much to bag (lbs)
              </th>
              <th className="px-4 py-2 text-right font-medium">
                Needed (lbs)
              </th>
              <th className="px-4 py-2 text-right font-medium">
                Committed (lbs)
              </th>
              <th className="px-4 py-2 text-right font-medium">
                Roasting (lbs)
              </th>
              <th className="px-4 py-2 text-right font-medium">
                To roast or pack (lbs)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 bg-white">
            {blends.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-stone-500"
                >
                  No blends to roast today.
                </td>
              </tr>
            ) : (
              blends.map((b) => (
                <tr key={b.blend}>
                  <td className="px-4 py-2 font-medium text-stone-900">
                    {b.blend}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatNum(b.howMuchToRoastLbs)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatNum(b.howMuchToBagLbs)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-stone-500">
                    {formatNum(b.neededLbs)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-stone-500">
                    {formatNum(b.committedLbs)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-stone-500">
                    {formatNum(b.roastingLbs)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-stone-500">
                    {formatNum(b.toRoastOrPackLbs)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ItemTable({ items }: { items: ItemRow[] }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold">By item</h2>
      <p className="mt-1 text-sm text-stone-600">
        Per-SKU bagging detail from NetSuite — pass-through, no calc.
      </p>
      <div className="mt-3 overflow-x-auto rounded border border-stone-200">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-100 text-stone-700">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Item</th>
              <th className="px-4 py-2 text-left font-medium">Units</th>
              <th className="px-4 py-2 text-right font-medium">Sold</th>
              <th className="px-4 py-2 text-right font-medium">Committed</th>
              <th className="px-4 py-2 text-right font-medium">Not roasted</th>
              <th className="px-4 py-2 text-right font-medium">In roasting</th>
              <th className="px-4 py-2 text-right font-medium">To assemble</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 bg-white">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-stone-500"
                >
                  No items to package today.
                </td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.item}>
                  <td className="px-4 py-2 font-medium text-stone-900">
                    {it.item}
                  </td>
                  <td className="px-4 py-2 text-stone-700">{it.unit}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatNum(it.unitsSold)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-stone-500">
                    {formatNum(it.unitsCommitted)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-stone-500">
                    {formatNum(it.unitsNotRoasted)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-stone-500">
                    {formatNum(it.unitsInRoasting)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatNum(it.unitsToAssemble)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2).replace(/\.?0+$/, "");
}

function formatGeneratedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/New_York",
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}
