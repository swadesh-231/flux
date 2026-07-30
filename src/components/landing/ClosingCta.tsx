import { SignInButton } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";

import { Accent, Section } from "@/components/reusables";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/constants";

export function ClosingCta() {
  return (
    <Section className="pt-0 sm:pt-0">
      <div className="relative isolate overflow-hidden rounded-2xl border border-border px-6 py-24 text-center sm:px-12">
        {/* Same bloom as the hero, so the page closes where it opened. */}
        <div
          aria-hidden
          className="hero-bloom pointer-events-none absolute inset-0 -z-10"
        />

        <h2 className="mx-auto max-w-xl text-balance font-heading text-[clamp(1.875rem,4vw,2.75rem)] font-normal leading-[1.1] tracking-[-0.015em] text-foreground/90">
          You already know what you want to build.{" "}
          <Accent>Go and describe it.</Accent>
        </h2>

        <p className="mx-auto mt-5 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
          {PLANS.free.generations} generations on the house. No card, no trial
          countdown, nothing to cancel.
        </p>

        <SignInButton mode="modal">
          <Button size="lg" className="mt-9 rounded-lg">
            Start building
            <ArrowRight data-icon="inline-end" aria-hidden />
          </Button>
        </SignInButton>
      </div>
    </Section>
  );
}

export default ClosingCta;
