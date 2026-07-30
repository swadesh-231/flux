import type { Metadata, Viewport } from "next";
import { Geist_Mono, Noto_Sans, Playfair_Display } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/ui/themes";

import "./globals.css";
import Footer from "@/components/base/Footer";
import Header from "@/components/base/Header";
import { ThemeProvider } from "@/components/theme-provider";
import { SITE } from "@/lib/constants";
import { cn } from "@/lib/utils";


const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-heading",
});

/** Body face, mapped to `--font-sans` in `globals.css`. */
const notoSans = Noto_Sans({ subsets: ["latin"], variable: "--font-sans" });

/** Used for micro-labels, figures, and code. */
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: {
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    type: "website",
  },
};

/**
 * `themeColor` and `colorScheme` belong to the `viewport` export, not
 * `metadata`, where they have been deprecated since Next 14.
 */
export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={{ theme: dark }}>
      <html
        lang="en"
        suppressHydrationWarning
        className={cn(
          "h-full antialiased",
          "font-sans",
          notoSans.variable,
          geistMono.variable,
          playfairDisplay.variable,
        )}
      >
        <body className="flex min-h-full flex-col">
          <ThemeProvider
            attribute="class"
            forcedTheme="dark"
            disableTransitionOnChange
          >
            <Header />
            <main className="flex-1 pt-24">{children}</main>
            <Footer />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
