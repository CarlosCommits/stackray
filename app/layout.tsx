import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { IBM_Plex_Sans } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Agentation } from "agentation";
import { getAnalyticsScriptConfig } from "@/lib/server/analytics";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

const siteTitle = "Stackray | Site Intelligence";
const siteDescription = "Run site intelligence scans, discover technology stacks, and review target history from one dashboard.";

export const metadata: Metadata = {
  metadataBase: new URL("https://stackray.app"),
  title: siteTitle,
  description: siteDescription,
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "/",
    siteName: "Stackray",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const analyticsScript = getAnalyticsScriptConfig();

  return (
    <html lang="en" className={cn("dark", GeistSans.className, GeistSans.variable, ibmPlexSans.variable)}>
      <body>
        <TooltipProvider>
          {children}
        </TooltipProvider>
        {process.env.NODE_ENV === "development" && <Agentation />}
      </body>
      {analyticsScript ? (
        <Script
          id="stackray-analytics"
          src={analyticsScript.src}
          data-website-id={analyticsScript.websiteId}
          data-domains={analyticsScript.domains}
          strategy="afterInteractive"
        />
      ) : null}
    </html>
  );
}
