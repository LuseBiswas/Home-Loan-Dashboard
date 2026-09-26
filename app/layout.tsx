import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Home Loan Compass",
  description: "A private workspace for understanding and managing a floating-rate home loan.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
