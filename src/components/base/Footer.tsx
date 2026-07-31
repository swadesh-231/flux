import Link from "next/link";

import { Eyebrow, SECTION_CONTAINER } from "@/components/reusables";
import { NAV_LINKS, SITE } from "@/lib/constants";
import { cn } from "@/lib/utils";

import Logo from "./Logo";

/**
 * Two rows sharing one container, so the brand block, the nav column, and the
 * legal line all sit on the same left and right edges. Everything stays
 * left-aligned when it stacks — the earlier version centred the bottom row on
 * small screens while the block above it stayed left, which read as a mistake.
 *
 * Closes the page with the same language the header opens it: a lit hairline
 * instead of a hard border, a gold bloom rising from the base, and the serif
 * italic wordmark — oversized, faded, and cropped by the page edge.
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden pb-0 pt-16">
      {/* Lit top edge in place of a border, matching the header pane. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
      />

      {/* Gold bloom under the wordmark, continuing the CTA band above. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-[radial-gradient(70%_100%_at_50%_100%,color-mix(in_oklab,var(--brand)_7%,transparent),transparent)]"
      />

      {/* Same track as every Section, so the footer's brand block starts on the
          column the page has used all the way down. */}
      <div className={cn("relative", SECTION_CONTAINER)}>
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

        <div className="mt-14 flex flex-col gap-3 border-t border-white/[0.06] pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-muted-foreground/60">
            © {year} {SITE.name}
          </p>

          <p className="text-xs text-muted-foreground">
            Made with ❤️ by {SITE.author}
          </p>
        </div>

        {/* The sign-off: the wordmark at display scale, fading as it leaves.
            The negative margin lets the page edge crop the glyphs. */}
        <p
          aria-hidden
          className="pointer-events-none -mb-[0.34em] mt-10 select-none bg-linear-to-b from-brand/20 via-brand/10 to-brand/0 bg-clip-text text-center font-heading text-[clamp(7rem,22vw,17rem)] italic leading-none tracking-[-0.04em] text-transparent"
        >
          flux
        </p>
      </div>
    </footer>
  );
}

export default Footer;
