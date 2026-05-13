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
      <body className="bg-stone-50 text-stone-900 antialiased">{children}</body>
    </html>
  );
}
