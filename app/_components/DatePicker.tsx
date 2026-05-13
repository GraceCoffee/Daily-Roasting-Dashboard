"use client";

export function DatePicker({
  value,
  min,
  max,
}: {
  value: string;
  min: string;
  max: string;
}) {
  return (
    <input
      type="date"
      name="date"
      defaultValue={value}
      min={min}
      max={max}
      onChange={(e) => {
        const picked = e.target.value;
        if (!picked) return;
        const url = new URL(window.location.href);
        url.searchParams.set("date", picked);
        window.location.href = url.toString();
      }}
      className="rounded border border-stone-300 px-2 py-1 text-sm tabular-nums focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
    />
  );
}
