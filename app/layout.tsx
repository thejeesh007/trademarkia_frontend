import type { Metadata } from "next";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trademarkia Collaborative Sheet",
  description: "Real-time collaborative spreadsheet prototype"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="app-shell">
          <ThemeToggle />
          {children}
        </div>
      </body>
    </html>
  );
}
