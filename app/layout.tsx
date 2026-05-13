import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grace Coffee — Daily Roasting Dashboard",
  description: "How much to roast, grind, and bag today.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-stone-50 text-stone-900 antialiased">
        <div className="flex justify-center pt-6 pb-2">
          <a href="/" aria-label="Grace Coffee — home" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/gc-logo.svg"
              alt="Grace Coffee"
              width={64}
              height={64}
              className="h-16 w-16"
            />
          </a>
        </div>
        {children}
      </body>
    </html>
  );
}
