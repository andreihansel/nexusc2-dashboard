import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NexusC2 — Command & Control",
  description: "Red Team Operator Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0a0f] text-white antialiased">
        {children}
      </body>
    </html>
  );
}
