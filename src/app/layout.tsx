import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Verkstads-ERP",
    template: "%s | Verkstads-ERP",
  },
  description: "Verkstadshanteringssystem för bilverkstäder",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv" className="dark">
      <body className="bg-workshop-bg text-workshop-text antialiased">
        {children}
      </body>
    </html>
  );
}
