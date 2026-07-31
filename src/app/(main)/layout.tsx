import { auth } from "@clerk/nextjs/server";

import AppHeader from "@/components/base/AppHeader";
import { checkUser } from "@/lib/checkUser";
import { DEFAULT_PLAN_KEY } from "@/lib/constants";

/**
 * The signed-in app shell: its own header, no marketing footer.
 *
 * The auth gate lives here rather than in the proxy — Clerk 7 deprecated
 * `createRouteMatcher` precisely because path matching can drift from how
 * Next.js routes a request. `auth.protect()` guards the resource itself and
 * redirects anonymous callers to sign-in.
 *
 * This is also where Clerk's subscription state is reconciled onto the local
 * `User` row: every page and server action underneath reads `credits` and
 * `plan` from that row, so it has to exist before they run. The row is read
 * here rather than fetched a second time for the header — `checkUser` is
 * request-cached, so the page below can call it again for free.
 */
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await auth.protect();
  const user = await checkUser();

  return (
    <>
      <AppHeader
        credits={user?.credits ?? 0}
        plan={user?.plan ?? DEFAULT_PLAN_KEY}
      />
      {/* pt-22 clears the fixed header: pt-4 inset + h-14 pane + gap. */}
      <main className="flex flex-1 flex-col pt-22">{children}</main>
    </>
  );
}
