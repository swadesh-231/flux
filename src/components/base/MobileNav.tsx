"use client";

import * as React from "react";
import Link from "next/link";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { ArrowRight, Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Below `md` the centre nav is hidden and this hamburger carries the same
 * links. Below `sm` the header CTAs disappear too, so the panel picks up
 * Sign in / Get started as a footer. Controlled, so those Clerk buttons can
 * close the menu before their modal opens.
 */
export function MobileNav({
  links,
}: {
  links: readonly { readonly href: string; readonly label: string }[];
}) {
  const [open, setOpen] = React.useState(false);
  const close = () => setOpen(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon-sm"
          className="rounded-full border-white/10 bg-white/[0.06] hover:bg-white/10 md:hidden"
          aria-label="Open navigation"
        >
          {/* Bars morph into a cross with a quarter turn, riding the
              aria-expanded state Radix puts on the trigger. */}
          <span className="relative size-4">
            <Menu
              aria-hidden
              className={cn(
                "absolute inset-0 size-4 transition-all duration-300 motion-reduce:transition-none",
                "group-aria-expanded/button:rotate-90 group-aria-expanded/button:scale-50 group-aria-expanded/button:opacity-0",
              )}
            />
            <X
              aria-hidden
              className={cn(
                "absolute inset-0 size-4 -rotate-90 scale-50 opacity-0 transition-all duration-300 motion-reduce:transition-none",
                "group-aria-expanded/button:rotate-0 group-aria-expanded/button:scale-100 group-aria-expanded/button:opacity-100",
              )}
            />
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={14}
        className={cn(
          // The same frosted-pane language as HeaderShell, so the panel reads
          // as an extension of it rather than a stock popover.
          "w-[min(20rem,calc(100vw-2rem))] rounded-2xl p-2",
          "bg-background/90 backdrop-blur-xl backdrop-saturate-150",
          "shadow-[0_24px_60px_-24px_rgb(0_0_0/0.7)]",
        )}
      >
        {/* Lit top edge, matching the header pane. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
        />

        {links.map((link) => (
          <DropdownMenuItem
            key={link.href}
            asChild
            className="rounded-lg px-3 py-2.5"
          >
            <Link href={link.href}>{link.label}</Link>
          </DropdownMenuItem>
        ))}

        {/* Auth actions live here only while the header hides its own. */}
        <div className="sm:hidden">
          <DropdownMenuSeparator className="-mx-2 my-2" />

          <div className="grid grid-cols-2 gap-2 p-1">
            <SignInButton mode="modal">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-white/10 bg-white/[0.04]"
                onClick={close}
              >
                Sign in
              </Button>
            </SignInButton>

            <SignUpButton mode="modal">
              <Button
                size="sm"
                className={cn(
                  "rounded-full",
                  "bg-linear-to-b from-white/25 via-white/5 to-transparent",
                  "shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_8px_20px_-8px_color-mix(in_oklab,var(--primary)_60%,transparent)]",
                )}
                onClick={close}
              >
                Get started
                <ArrowRight data-icon="inline-end" aria-hidden />
              </Button>
            </SignUpButton>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default MobileNav;
