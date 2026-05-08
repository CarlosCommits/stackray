import type { Metadata } from "next";
import "./globals.css";
import { Space_Grotesk } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Agentation } from "agentation";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Stackray | Site Analyzer",
  description: "Site intelligence and technology discovery platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("dark", GeistSans.className, GeistSans.variable, spaceGrotesk.variable)}>
      <body>
        <TooltipProvider>
          {children}
        </TooltipProvider>
        {process.env.NODE_ENV === "development" && <Agentation />}
      </body>
    </html>
  );
}
