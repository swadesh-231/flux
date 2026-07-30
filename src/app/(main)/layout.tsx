import { auth } from "@clerk/nextjs/server";

import Header from "@/components/base/Header";
import { checkUser } from "@/lib/checkUser";

/**
 * The signed-in app shell: header, no marketing footer.
 *
 * The auth gate lives here rather than in the proxy — Clerk 7 deprecated
 * `createRouteMatcher` precisely because path matching can drift from how
 * Next.js routes a request. `auth.protect()` guards the resource itself and
 * redirects anonymous callers to sign-in.
 *
 * This is also where Clerk's subscription state is reconciled onto the local
 * `User` row: every page and server action underneath reads `credits` and
 * `plan` from that row, so it has to exist before they run.
 */
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await auth.protect();
  await checkUser();

  return (
    <>
      <Header />
      {/* pt-22 clears the fixed header: pt-4 inset + h-14 pane + gap. */}
      <main className="flex flex-1 flex-col pt-22">{children}</main>
    </>
  );
}
