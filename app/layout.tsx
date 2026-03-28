import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FISHLENS — Codebase Wide-Angle Scanner",
  description: "AI-powered codebase analysis with a retro wide-angle view",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
