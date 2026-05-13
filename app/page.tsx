import {
  getLatestSnapshot,
  getSnapshotByDate,
  getSnapshotDateBoundaries,
  type BlendRow,
  type ItemRow,
} from "@/lib/db";
import { DatePicker } from "./_components/DatePicker";

export const dynamic = "force-dynamic";

type LoadedSnapshot = NonNullable<Awaited<ReturnType<typeof getLatestSnapshot>>>;

type SearchParams = Promise<{ date?: string }>;

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const requestedDate = isValidDateString(params.date) ? params.date! : null;

  let snapshot: LoadedSnapshot | null = null;
  let boundaries: Awaited<ReturnType<typeof getSnapshotDateBoundaries>> | null =
    null;
  let dbError: string | null = null;
  try {
    snapshot = requestedDate
      ? await getSnapshotByDate(requestedDate)
      : await getLatestSnapshot();
    boundaries = await getSnapshotDateBoundaries(
      snapshot?.snapshotDate ?? requestedDate ?? "1970-01-01",
    );
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  const viewingDate = snapshot?.snapshotDate ?? requestedDate;
  const isViewingLatest =
    snapshot !== null && boundaries?.latest === snapshot.snapshotDate;

  return (
    <main className="mx-auto max-w-7xl px-6 pt-4 pb-10">
      <header className="border-b border-stone-200 pb-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">
            Daily Roasting Dashboard
          </h1>
          <form method="POST" action="/api/logout">
            <button
              type="submit"
              className="text-sm text-stone-500 hover:text-stone-900 hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          {boundaries && boundaries.earliest && boundaries.latest ? (
            <DateNav
              viewingDate={viewingDate}
              boundaries={boundaries}
              isViewingLatest={isViewingLatest}
            />
          ) : null}

          <div className="text-stone-600">
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
            ) : requestedDate ? (
              <span className="text-amber-700">
                No snapshot for {requestedDate}.
              </span>
            ) : dbError ? (
              <span className="text-red-700">{dbError}</span>
            ) : (
              "No snapshot yet."
            )}
          </div>
        </div>
      </header>

      {snapshot ? (
        <>
          {snapshot.payload.warnings.length > 0 ? (
            <WarningBanner warnings={snapshot.payload.warnings} />
          ) : null}
          <BlendTable blends={snapshot.payload.blends} />
          <ItemTable items={snapshot.payload.items} />
        </>
      ) : requestedDate ? (
        <MissingDateState
          requestedDate={requestedDate}
          haveAnySnapshots={Boolean(boundaries?.latest)}
        />
      ) : (
        <EmptyState />
      )}
    </main>
  );
}

function DateNav({
  viewingDate,
  boundaries,
  isViewingLatest,
}: {
  viewingDate: string | null;
  boundaries: NonNullable<
    Awaited<ReturnType<typeof getSnapshotDateBoundaries>>
  >;
  isViewingLatest: boolean;
}) {
  const prevHref = boundaries.prev ? `/?date=${boundaries.prev}` : null;
  const nextHref = boundaries.next ? `/?date=${boundaries.next}` : null;
  const inputValue = viewingDate ?? boundaries.latest ?? "";
  return (
    <div className="flex items-center gap-1">
      <ArrowLink
        href={prevHref}
        label="Previous snapshot"
        symbol="←"
        disabled={!prevHref}
      />
      <DatePicker
        value={inputValue}
        min={boundaries.earliest ?? ""}
        max={boundaries.latest ?? ""}
      />
      <ArrowLink
        href={nextHref}
        label="Next snapshot"
        symbol="→"
        disabled={!nextHref}
      />
      {!isViewingLatest && boundaries.latest ? (
        <a
          href="/"
          className="ml-2 rounded border border-stone-300 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100"
        >
          Latest
        </a>
      ) : null}
    </div>
  );
}

function ArrowLink({
  href,
  label,
  symbol,
  disabled,
}: {
  href: string | null;
  label: string;
  symbol: string;
  disabled: boolean;
}) {
  const className =
    "inline-flex h-8 w-8 items-center justify-center rounded border text-base " +
    (disabled
      ? "cursor-not-allowed border-stone-200 text-stone-300"
      : "border-stone-300 text-stone-700 hover:bg-stone-100");
  if (disabled || !href) {
    return (
      <span aria-disabled className={className} title={label}>
        {symbol}
      </span>
    );
  }
  return (
    <a href={href} className={className} title={label} aria-label={label}>
      {symbol}
    </a>
  );
}

function isValidDateString(s: string | undefined): boolean {
  if (!s) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime());
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

function MissingDateState({
  requestedDate,
  haveAnySnapshots,
}: {
  requestedDate: string;
  haveAnySnapshots: boolean;
}) {
  return (
    <div className="mt-12 rounded border border-dashed border-stone-300 p-8 text-center text-stone-600">
      <p className="font-medium">
        No snapshot was recorded for {requestedDate}.
      </p>
      {haveAnySnapshots ? (
        <p className="mt-2 text-sm">
          Use the arrows above to jump to the nearest available snapshot, or{" "}
          <a href="/" className="font-medium text-stone-900 hover:underline">
            view the latest
          </a>
          .
        </p>
      ) : null}
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
          <thead className="bg-grace-blue text-white">
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
                <tr key={b.blend} className="group">
                  <td className="px-4 py-2 font-medium text-stone-900 group-hover:bg-grace-blue/5">
                    {b.blend}
                  </td>
                  <td className="bg-grace-blue/5 px-4 py-2 text-right font-semibold tabular-nums text-grace-blue group-hover:bg-grace-blue/15">
                    {formatNum(b.howMuchToRoastLbs)}
                  </td>
                  <td className="bg-grace-blue/5 px-4 py-2 text-right font-semibold tabular-nums text-grace-blue group-hover:bg-grace-blue/15">
                    {formatNum(b.howMuchToBagLbs)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-stone-500 group-hover:bg-grace-blue/5">
                    {formatNum(b.neededLbs)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-stone-500 group-hover:bg-grace-blue/5">
                    {formatNum(b.committedLbs)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-stone-500 group-hover:bg-grace-blue/5">
                    {formatNum(b.roastingLbs)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-stone-500 group-hover:bg-grace-blue/5">
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
          <thead className="bg-grace-blue text-white">
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
                <tr key={it.item} className="group">
                  <td className="px-4 py-2 font-medium text-stone-900 group-hover:bg-grace-blue/5">
                    {it.item}
                  </td>
                  <td className="px-4 py-2 text-stone-700 group-hover:bg-grace-blue/5">
                    {it.unit}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums group-hover:bg-grace-blue/5">
                    {formatNum(it.unitsSold)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-stone-500 group-hover:bg-grace-blue/5">
                    {formatNum(it.unitsCommitted)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-stone-500 group-hover:bg-grace-blue/5">
                    {formatNum(it.unitsNotRoasted)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-stone-500 group-hover:bg-grace-blue/5">
                    {formatNum(it.unitsInRoasting)}
                  </td>
                  <td className="bg-grace-blue/5 px-4 py-2 text-right font-semibold tabular-nums text-grace-blue group-hover:bg-grace-blue/15">
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
