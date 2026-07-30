import Link from "next/link";

import { Eyebrow } from "@/components/reusables";
import { NAV_LINKS, SITE } from "@/lib/constants";

import Logo from "./Logo";

/**
 * Two rows sharing one container, so the brand block, the nav column, and the
 * legal line all sit on the same left and right edges. Everything stays
 * left-aligned when it stacks — the earlier version centred the bottom row on
 * small screens while the block above it stayed left, which read as a mistake.
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border px-6 pb-12 pt-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-16">
          <div className="max-w-sm">
            <Link
              href="/"
              aria-label={`${SITE.name} — home`}
              className="inline-flex text-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <Logo />
            </Link>

            <p className="mt-5 text-pretty text-sm leading-relaxed text-muted-foreground">
              {SITE.description}
            </p>
          </div>

          <nav aria-label="Footer" className="sm:min-w-36">
            <Eyebrow>Explore</Eyebrow>

            <ul className="mt-5 space-y-3">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-muted-foreground/60">
            © {year} {SITE.name}
          </p>

          <p className="text-xs text-muted-foreground">
            Made with ❤️ by {SITE.author}
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
