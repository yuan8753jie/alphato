import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/sidebar";

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
        <Sidebar />
        <main className="ml-[220px] min-h-screen p-6">
          {children}
        </main>
      </body>
    </html>
  );
}
