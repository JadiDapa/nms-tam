import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import Providers from "@/providers/Providers";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Netpulse",
  description:
    "Netpulse keeps a live pulse on your network — monitor devices, catch outages, and manage alerts from one dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={cn(inter.variable, jetbrainsMono.variable)}
      suppressHydrationWarning
      lang="en"
    >
      <body>
        <Providers>
          <Toaster richColors position="top-right" />
          {children}
        </Providers>
      </body>
    </html>
  );
}
