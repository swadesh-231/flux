import Footer from "@/components/base/Footer";
import Header from "@/components/base/Header";

/**
 * The marketing surface: full chrome, header and footer both.
 *
 * `pt-22` clears the fixed header — `pt-4` inset + `h-14` pane + gap. Changing
 * the header's height or inset means updating this value here and in the other
 * route-group layouts.
 */
export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Header />
      <main className="flex-1 pt-22">{children}</main>
      <Footer />
    </>
  );
}
