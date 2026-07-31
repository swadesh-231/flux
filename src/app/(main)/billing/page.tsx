import type { Metadata } from "next";
import { PricingTable } from "@clerk/nextjs";

import { Accent, Display, Eyebrow } from "@/components/reusables";

export const metadata: Metadata = { title: "Billing" };

/**
 * Where the landing page's Upgrade / Downgrade buttons land.
 *
 * Clerk owns subscription state, so this is Clerk's own `PricingTable` rather
 * than a second hand-rolled plan grid — it reads the plans configured in the
 * dashboard and drives checkout, and `checkUser` reconciles the result onto
 * the local `User` row on the next page view.
 */
export default function BillingPage() {
  return (
    // Same track as /projects and the app header, so the two signed-in pages
    // start on the same column.
    <div className="mx-auto w-full max-w-6xl px-6 pb-24 pt-10">
      <header className="mb-12">
        <Eyebrow>Account</Eyebrow>

        <Display className="mt-4 text-[clamp(2rem,5vw,3rem)]">
          Plan and <Accent>billing.</Accent>
        </Display>

        <p className="mt-3 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
          Change plan or cancel whenever you like. Upgrades top your remaining
          generations up by the difference straight away.
        </p>
      </header>

      <PricingTable />
    </div>
  );
}
