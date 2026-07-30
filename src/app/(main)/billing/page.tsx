import type { Metadata } from "next";
import { PricingTable } from "@clerk/nextjs";

import { Accent, Display } from "@/components/reusables";

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
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-12">
        <Display className="text-[clamp(2rem,5vw,3rem)]">
          Plan and <Accent>billing.</Accent>
        </Display>
        <p className="mt-3 text-sm text-muted-foreground">
          Change plan or cancel whenever you like.
        </p>
      </header>

      <PricingTable />
    </div>
  );
}
