import { StarsBackground } from "@/components/animation/stars";
import { Accent, Display } from "@/components/reusables";
import { Badge } from "@/components/ui/badge";
import { PLANS, SITE } from "@/lib/constants";
import { OUTPUT_STACK } from "@/lib/data";
import { cn } from "@/lib/utils";

import HeroBackdrop from "./HeroBackdrop";
import PromptComposer from "./PromptComposer";

/** Staged entrance. Each row lands just after the one above it. */
const rise = "animate-rise motion-reduce:animate-none";

/** Warm white, so the stars sit in the same light as the gold bloom. */
const STAR_COLOUR = "#f6efe1";

export function Hero() {
  return (
    // The layout offsets `<main>` by `pt-22` to clear the fixed header; the
    // hero cancels that and re-applies it as padding, so the sky and the
    // starfield run all the way to the top of the page and sit behind the
    // frosted pane instead of starting 5.5rem below it. Content lands in the
    // same place either way.
    <StarsBackground
      className="hero-sky isolate -mt-22 pt-22"
      starColor={STAR_COLOUR}
      pointerEvents={false}
    >
      <HeroBackdrop />

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 pb-28 pt-12 text-center sm:pb-32 sm:pt-16">
        <Badge
          variant="secondary"
          className={cn(
            rise,
            "gap-2 rounded-full border border-brand/25 bg-brand/[0.07] px-3 py-1.5 text-brand-soft tracking-[0.18em] backdrop-blur-sm",
          )}
        >
          <span aria-hidden className="relative flex size-1.5 items-center">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand/60 motion-reduce:animate-none" />
            <span className="relative size-1.5 rounded-full bg-brand" />
          </span>
          {SITE.tagline}
        </Badge>

        <Display className={cn(rise, "mt-7 [animation-delay:80ms]")}>
          From a sentence <Accent>to a running app.</Accent>
        </Display>

        <p
          className={cn(
            rise,
            "mt-5 max-w-xl text-pretty text-[0.9375rem] leading-relaxed text-muted-foreground [animation-delay:160ms]",
          )}
        >
          {SITE.description}
        </p>

        <div className={cn(rise, "mt-10 w-full [animation-delay:240ms]")}>
          <PromptComposer />
        </div>

        <p
          className={cn(
            rise,
            "mt-8 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground [animation-delay:320ms]",
          )}
        >
          <span className="text-brand-soft">
            {PLANS.free.generations} free generations
          </span>
          <span aria-hidden className="mx-2 text-muted-foreground/40">
            /
          </span>
          no card required
        </p>

        <div
          className={cn(
            rise,
            "mt-14 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 [animation-delay:400ms]",
          )}
        >
          <span className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-muted-foreground/70">
            Ships as
          </span>

          {OUTPUT_STACK.map((item) => (
            <span
              key={item}
              className="text-[0.8125rem] tracking-tight text-muted-foreground"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </StarsBackground>
  );
}

export default Hero;
