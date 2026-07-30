"use client";

import { useAuth, SignInButton } from "@clerk/nextjs";
import { CheckoutButton } from "@clerk/nextjs/experimental";
import { ArrowRight, Check } from "lucide-react";

import { Accent } from "@/components/reusables";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  PLAN_LIST,
  planFeatures,
  planRank,
  resolveActivePlanKey,
  type PlanKey,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

interface PricingModalProps {
  children: React.ReactNode;
  reason?: "credits" | "upgrade";
}

/**
 * The in-workspace upgrade path. The landing page has its own server-rendered
 * pricing section; this one runs client-side because it opens from a button
 * inside the workspace and needs `has()` to resolve the caller's plan.
 *
 * Plan data, ordering, and the Clerk plan ids all come from `PLANS` — the
 * single seam between this UI and the Clerk dashboard.
 */
export function PricingModal({
  children,
  reason = "upgrade",
}: PricingModalProps) {
  const { isSignedIn, has } = useAuth();

  const title =
    reason === "credits" ? "You're out of credits" : "Upgrade your plan";
  const description =
    reason === "credits"
      ? "You've used all your credits. Upgrade to keep building."
      : "Choose a plan that fits how much you build.";

  const activePlanKey: PlanKey | null =
    isSignedIn && has ? resolveActivePlanKey((key) => has({ plan: key })) : null;

  return (
    <Dialog>
      <DialogTrigger className="cursor-pointer">{children}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-border bg-card/95 p-0 sm:max-w-5xl">
        <DialogHeader className="px-6 pb-2 pt-6">
          <DialogTitle className="font-heading text-3xl font-normal tracking-tight">
            <Accent>{title}</Accent>
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 px-6 pb-6 sm:grid-cols-3">
          {PLAN_LIST.filter((plan) => plan.active).map((plan) => {
            const isActive = activePlanKey === plan.key;
            const isDowngrade =
              activePlanKey !== null &&
              !isActive &&
              planRank(plan.key) < planRank(activePlanKey);

            return (
              <div
                key={plan.key}
                className={cn(
                  "relative flex flex-col rounded-2xl border p-5 transition-colors",
                  plan.featured
                    ? "border-brand/25 bg-brand/[0.045]"
                    : "border-border bg-background",
                )}
              >
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full border border-brand/25 bg-background px-3 py-1 text-[11px] font-medium text-brand">
                      Most popular
                    </span>
                  </div>
                )}

                <div className="mb-1 flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {plan.label}
                  </p>
                  {isActive && (
                    <span className="rounded-full border border-brand/25 bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                      Active
                    </span>
                  )}
                </div>

                <p className="mb-6 text-xs leading-relaxed text-muted-foreground">
                  {plan.description}
                </p>

                <div className="mb-1 flex items-baseline gap-1">
                  <span className="font-heading text-4xl">
                    {plan.price === 0 ? (
                      <span className="text-foreground/90">$0</span>
                    ) : (
                      <Accent>${plan.price}</Accent>
                    )}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-sm text-muted-foreground">/mo</span>
                  )}
                </div>
                <p className="mb-6 text-xs text-muted-foreground">
                  {plan.price === 0 ? "Always free" : "Billed monthly"}
                </p>

                <div className="mb-8 space-y-3 border-t border-border pt-6">
                  {planFeatures(plan).map((feature) => (
                    <div key={feature} className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-full",
                          plan.featured ? "bg-brand/15" : "bg-muted",
                        )}
                      >
                        <Check
                          className={cn(
                            "size-2.5",
                            plan.featured ? "text-brand" : "text-foreground/50",
                          )}
                          aria-hidden
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CTA. The tier without a Clerk plan id is the floor every
                    account already has, so it never leads to checkout —
                    checking that (rather than `price === 0`) is also what
                    narrows `clerkPlanId` to a string for CheckoutButton. */}
                <div className="mt-auto">
                  {isActive ? (
                    <Button disabled variant="outline" className="w-full rounded-full">
                      Current plan
                    </Button>
                  ) : plan.clerkPlanId === null ? (
                    isSignedIn ? (
                      <Button disabled variant="outline" className="w-full rounded-full">
                        Included
                      </Button>
                    ) : (
                      <SignInButton mode="modal">
                        <Button variant="outline" className="w-full rounded-full">
                          Get started free
                          <ArrowRight data-icon="inline-end" aria-hidden />
                        </Button>
                      </SignInButton>
                    )
                  ) : isSignedIn ? (
                    <CheckoutButton
                      planId={plan.clerkPlanId}
                      planPeriod="month"
                      checkoutProps={{
                        appearance: {
                          elements: {
                            // Above the dialog, which Radix puts at z-50.
                            drawerRoot: { zIndex: 2000 },
                          },
                        },
                      }}
                    >
                      <Button
                        variant={plan.featured ? "default" : "outline"}
                        className="w-full rounded-full"
                      >
                        {isDowngrade ? "Downgrade" : "Upgrade"}
                        <ArrowRight data-icon="inline-end" aria-hidden />
                      </Button>
                    </CheckoutButton>
                  ) : (
                    <SignInButton mode="modal">
                      <Button
                        variant={plan.featured ? "default" : "outline"}
                        className="w-full rounded-full"
                      >
                        Upgrade
                        <ArrowRight data-icon="inline-end" aria-hidden />
                      </Button>
                    </SignInButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
