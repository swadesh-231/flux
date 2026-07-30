import type { Metadata, Viewport } from "next";
import { Geist_Mono, Noto_Sans, Playfair_Display } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/ui/themes";

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
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
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: {
    default: SITE.name,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: {
    siteName: SITE.name,
    title: `${SITE.name}`,
    description: SITE.description,
    type: "website",
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0a0a0a",
};

/**
 * Providers only. Page chrome — header, footer, and the offset that clears the
 * fixed header — belongs to the route-group layouts, because the marketing
 * surface, the auth pages, and the full-height workspace each want a different
 * one.
 */
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
            {children}
            <Toaster position="top-center" />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
