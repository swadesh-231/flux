import Link from "next/link";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { APP_NAV_LINKS, NAV_LINKS, SITE } from "@/lib/constants";
import { cn } from "@/lib/utils";

import HeaderShell from "./HeaderShell";
import Logo from "./Logo";
import MobileNav from "./MobileNav";
import { NavLink } from "./NavLink";

/** Tightens up in step with the shell as it condenses. */
const squeeze =
  "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

/**
 * The marketing navbar, worn by the landing page and the auth pages.
 *
 * Three zones on a grid so the centre group is optically centred rather than
 * wherever `justify-between` happens to leave it. The centre track carries the
 * page anchors and nothing else — a signed-in visitor gets "Open app" in the
 * right cluster, next to their avatar, because their own workspace belongs with
 * their account rather than in the middle of a marketing bar. The signed-in app
 * itself wears `AppHeader`.
 */
const Header = () => {
  return (
    <HeaderShell>
      <nav className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 sm:gap-4 sm:px-6">
        <div className="flex min-w-0 justify-start">
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

        {/* Page anchors, and only page anchors. */}
        <div className="hidden items-center md:flex">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.href} href={link.href}>
              {link.label}
            </NavLink>
          ))}
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
            {/* One way back into the app, rather than a second nav cluster. */}
            <Button
              asChild
              size="sm"
              className="hidden rounded-full sm:inline-flex"
            >
              <Link href="/projects">
                Open app
                <ArrowRight data-icon="inline-end" aria-hidden />
              </Link>
            </Button>

            {/* Separates account from navigation — the pause reads as structure. */}
            <span aria-hidden className="hidden h-5 w-px bg-border sm:block" />

            <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />

            {/* Carries the app's own destinations too, since the "Open app"
                button above is hidden at this width. */}
            <MobileNav
              links={[...APP_NAV_LINKS, ...NAV_LINKS]}
              withAuthActions={false}
            />
          </Show>
        </div>
      </nav>
    </HeaderShell>
  );
};

export default Header;
