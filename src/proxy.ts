import arcjet, { detectBot, shield } from "@arcjet/next";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// ─── Global Arcjet client ─────────────────────────────────────────────────────
// Runs on every request. Looser than the route-level client — allows search
// engines and link previews so the landing page gets indexed and
// Slack/Twitter unfurls work.

const aj = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({
      mode: "LIVE",
      allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW"],
    }),
  ],
});

/**
 * Edge protection only. The auth gate deliberately does NOT live here:
 * `createRouteMatcher` is deprecated in Clerk 7 because path matching can
 * diverge from how Next.js actually routes a request, leaving protected
 * resources reachable. The signed-in area is gated by `auth.protect()` in
 * `src/app/(main)/layout.tsx`, and every server action and route handler
 * re-checks `auth()` for itself.
 */
export default clerkMiddleware(async (_auth, req) => {
  const decision = await aj.protect(req);
  if (decision.isDenied()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for Clerk's auto-proxy path
    "/__clerk/:path*",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
