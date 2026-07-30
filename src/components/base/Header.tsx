import Link from "next/link";
import { Button } from "../ui/button";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { ArrowRight, Sparkles } from "lucide-react";
import Logo from "./Logo";

// Matches the squared, uppercase, wide-tracked language of buttonVariants.
const navItem =
  "text-xs font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="Flux — home"
          className="text-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <Logo wordmarkClassName="hidden sm:block" />
        </Link>

        <div className="flex items-center gap-3 sm:gap-5">
          <Show when="signed-in">
            <Link href="/projects" className={navItem}>
              Projects
            </Link>

            <span className="inline-flex h-9 items-center gap-1.5 border border-border px-3 text-[0.625rem] font-semibold uppercase tracking-widest text-muted-foreground">
              <Sparkles className="size-3" aria-hidden />
              credits
            </span>

            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8",
                },
              }}
            />
          </Show>

          <Show when="signed-out">
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                Sign in
              </Button>
            </SignInButton>

            <SignUpButton mode="modal">
              <Button size="sm">
                Get Started
                <ArrowRight data-icon="inline-end" aria-hidden />
              </Button>
            </SignUpButton>
          </Show>
        </div>
      </nav>
    </header>
  );
};

export default Header;
