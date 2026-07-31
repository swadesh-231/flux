import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Shared between the marketing nav and the app nav so both sit on the same
 * baseline and shrink together with the shell.
 *
 * Built as a target rather than a label: a full-height hit area with a pill
 * plate on hover, in the uppercase micro-type of the design system. `data-active`
 * carries the current-page state — only the app nav sets it, because the
 * marketing links are fragments and never own a route.
 */
export const navLinkClasses = cn(
  "inline-flex h-9 items-center rounded-full px-3.5",
  "text-[0.6875rem] font-semibold uppercase tracking-widest",
  "text-muted-foreground hover:bg-white/[0.07] hover:text-foreground",
  "data-[active=true]:bg-brand/[0.1] data-[active=true]:text-brand-soft",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
  "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
  "group-data-[state=condensed]/header:h-8",
);

export function NavLink({
  href,
  active,
  className,
  children,
}: {
  href: string;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      data-active={active ? "true" : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(navLinkClasses, className)}
    >
      {children}
    </Link>
  );
}

export default NavLink;
