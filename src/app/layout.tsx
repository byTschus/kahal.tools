import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "kahal.tools",
  description: "Services und Kennzahlen für Gemeinden an einem Ort.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
