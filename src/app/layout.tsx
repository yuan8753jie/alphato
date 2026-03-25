import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Nav } from "@/components/nav";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "AlphaTo",
  description: "AI 驱动的社交媒体内容运营平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={cn("font-sans", geist.variable)}>
      <body className="antialiased" suppressHydrationWarning>
        <Nav />
        <main className="max-w-[1400px] mx-auto px-6 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
