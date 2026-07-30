import Link from "next/link";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NAV_LINKS, SITE } from "@/lib/constants";
import { cn } from "@/lib/utils";

import HeaderShell from "./HeaderShell";
import Logo from "./Logo";
import MobileNav from "./MobileNav";

/** Tightens up in step with the shell as it condenses. */
const squeeze =
  "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

/**
 * A nav link built as a target, not a label: full-height hit area with a
 * squared plate on hover, in the uppercase micro-type of the design system.
 */
function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9 items-center rounded-lg px-3",
        "text-[0.6875rem] font-semibold uppercase tracking-widest",
        "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        squeeze,
        "group-data-[state=condensed]/header:h-8",
      )}
    >
      {children}
    </Link>
  );
}

const Header = () => {
  return (
    <HeaderShell>
      {/* Three zones on a grid, so the centre group sits optically centred
          rather than wherever justify-between happens to leave it. */}
      <nav className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6">
        <div className="flex justify-start">
          <Link
            href="/"
            aria-label={`${SITE.name} — home`}
            className="text-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <Logo
              wordmarkClassName="hidden sm:block"
              className={cn(
                "origin-left",
                squeeze,
                "group-data-[state=condensed]/header:scale-[0.94]",
              )}
            />
          </Link>
        </div>

        <div className="hidden items-center md:flex">
          <Show when="signed-out">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.href} href={link.href}>
                {link.label}
              </NavLink>
            ))}
          </Show>

          <Show when="signed-in">
            <NavLink href="/projects">Projects</NavLink>
          </Show>
        </div>

        <div className="flex items-center justify-end gap-2 sm:gap-3">
          <Show when="signed-out">
            <MobileNav links={NAV_LINKS} />

            <SignInButton mode="modal">
              <Button
                variant="ghost"
                size="sm"
                className="hidden rounded-lg sm:inline-flex"
              >
                Sign in
              </Button>
            </SignInButton>

            <SignUpButton mode="modal">
              <Button size="sm" className="rounded-lg">
                Start free
                <ArrowRight data-icon="inline-end" aria-hidden />
              </Button>
            </SignUpButton>
          </Show>

          <Show when="signed-in">
            <Button asChild size="sm" className="rounded-lg">
              <Link href="/workspace">
                New project
                <ArrowRight data-icon="inline-end" aria-hidden />
              </Link>
            </Button>

            {/* Separates account from navigation — the pause reads as structure. */}
            <span aria-hidden className="hidden h-5 w-px bg-border sm:block" />

            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8",
                },
              }}
            />
          </Show>
        </div>
      </nav>
    </HeaderShell>
  );
};

export default Header;
