import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mó — Fasteignakerfi",
  description: "Yfirlit fyrir fasteignasala",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="is" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
