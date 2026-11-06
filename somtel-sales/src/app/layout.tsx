import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Somtel Enterprise Sales", template: "%s | Somtel Enterprise" },
  description: "Sales and order management for Somtel Enterprise",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
