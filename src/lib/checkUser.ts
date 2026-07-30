import "server-only";

import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";

import { Prisma } from "@/generated/prisma/client";

import { db } from "./prisma";
import {
  DEFAULT_PLAN_KEY,
  PLANS,
  planCredits,
  resolveActivePlanKey,
  type PlanKey,
} from "./constants";

/** P2002 — the row was inserted by someone else between our read and write. */
function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/**
 * Clerk owns subscription state; this mirrors it onto the local `User` row so
 * the generation routes can gate on `plan` and decrement `credits` without a
 * Clerk round trip.
 *
 * Wrapped in React's `cache()`, which is what makes it safe to call from more
 * than one place: a layout and the page beneath it render *in parallel*, so
 * two uncached calls would both read "no row" on a first visit and both try to
 * insert. Cached, they share one promise per request. The `create` is still
 * guarded for the cross-request version of the same race.
 */
export const checkUser = cache(async () => {
  const user = await currentUser();
  if (!user) return null;

  const email = user.emailAddresses[0]?.emailAddress;
  if (!email) return null;

  try {
    const { has } = await auth();
    const currentPlan: PlanKey = resolveActivePlanKey((key) =>
      has({ plan: key }),
    );

    const existing = await db.user.findUnique({ where: { clerkId: user.id } });

    if (!existing) {
      try {
        return await db.user.create({
          data: {
            clerkId: user.id,
            name:
              `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || email,
            email,
            imageUrl: user.imageUrl ?? "",
            credits: PLANS[DEFAULT_PLAN_KEY].generations,
            plan: DEFAULT_PLAN_KEY,
          },
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        // Lost the insert race — a concurrent request created the row, which
        // is the outcome we wanted anyway. Read it back.
        return await db.user.findUnique({ where: { clerkId: user.id } });
      }
    }

    if (existing.plan === currentPlan) return existing;

    // Top up on upgrade only. A downgrade keeps whatever is left rather than
    // clawing credits back mid-cycle.
    const delta = planCredits(currentPlan) - planCredits(existing.plan);

    // Guarding on the old plan makes the top-up idempotent: two concurrent
    // requests that both see the stale plan produce one credit grant, because
    // the second `updateMany` matches zero rows.
    await db.user.updateMany({
      where: { clerkId: user.id, plan: existing.plan },
      data: {
        plan: currentPlan,
        ...(delta > 0 ? { credits: { increment: delta } } : {}),
      },
    });

    return await db.user.findUnique({ where: { clerkId: user.id } });
  } catch (error) {
    console.error("[checkUser]", error);
    return null;
  }
});
