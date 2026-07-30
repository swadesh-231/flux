import Link from "next/link";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";

import { NewProjectDialog } from "@/components/project/NewProjectDialog";
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
        "inline-flex h-9 items-center rounded-full px-3.5",
        "text-[0.6875rem] font-semibold uppercase tracking-widest",
        "text-muted-foreground hover:bg-white/[0.07] hover:text-foreground",
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
      <nav className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 sm:gap-4 sm:px-6">
        <div className="flex justify-start">
          <Link
            href="/"
            aria-label={`${SITE.name} — home`}
            className="text-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <Logo
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

        {/* Pinned to the third track — when the centre nav is display:none
            below md, auto-placement would otherwise pull this into column 2. */}
        <div className="col-start-3 flex items-center justify-end gap-2 sm:gap-3">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <Button
                variant="ghost"
                size="sm"
                className="hidden rounded-full text-muted-foreground hover:bg-white/[0.07] sm:inline-flex"
              >
                Sign in
              </Button>
            </SignInButton>

            <SignUpButton mode="modal">
              <Button
                size="sm"
                className={cn(
                  "hidden rounded-full sm:inline-flex",
                  // Sheen over the brand gold, plus a soft gold bloom below.
                  "bg-linear-to-b from-white/25 via-white/5 to-transparent",
                  "shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_8px_20px_-8px_color-mix(in_oklab,var(--primary)_60%,transparent)]",
                  "hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_10px_26px_-8px_color-mix(in_oklab,var(--primary)_85%,transparent)]",
                )}
              >
                Get started
                <ArrowRight data-icon="inline-end" aria-hidden />
              </Button>
            </SignUpButton>

            <MobileNav links={NAV_LINKS} />
          </Show>

          <Show when="signed-in">
            {/* Opens the naming dialog rather than dropping straight into an
                untitled workspace. */}
            <NewProjectDialog>
              <Button size="sm" className="rounded-full">
                New project
                <ArrowRight data-icon="inline-end" aria-hidden />
              </Button>
            </NewProjectDialog>

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
