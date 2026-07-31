"use client";

import { usePathname } from "next/navigation";

import { APP_NAV_LINKS } from "@/lib/constants";

import { NavLink } from "./NavLink";

/**
 * The signed-in nav, sitting beside the logo rather than in the centre track.
 *
 * The only reason this is a client component is `usePathname` — a layout never
 * sees the current route, and marking the whole app header client-side to get
 * one highlight would be a poor trade. Everything else in `AppHeader` stays on
 * the server.
 */
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Application" className="hidden items-center sm:flex">
      {APP_NAV_LINKS.map((link) => (
        <NavLink
          key={link.href}
          href={link.href}
          active={pathname === link.href || pathname.startsWith(`${link.href}/`)}
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default AppNav;
