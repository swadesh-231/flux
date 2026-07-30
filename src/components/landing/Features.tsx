import { Section, SectionHeader } from "@/components/reusables";
import { FEATURES } from "@/lib/data";

/**
 * Hairline grid: the wrapper supplies the rule colour and `gap-px` opens
 * one-pixel gutters, so the dividers are the background showing through rather
 * than borders that double up at the seams.
 */
export function Features() {
  return (
    <Section id="features">
      <SectionHeader
        eyebrow="Capabilities"
        title="Everything between the idea"
        accent="and the deploy button."
        lead="Not a template gallery. Flux reasons about what you asked for, then builds it the way a careful engineer would."
      />

      <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, label, desc }, index) => (
          <article
            key={label}
            className="group bg-background p-7 transition-colors duration-300 hover:bg-foreground/[0.025]"
          >
            <div className="flex items-start justify-between gap-4">
              <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-foreground/[0.03] transition-colors duration-300 group-hover:border-brand/30 group-hover:bg-brand/[0.08]">
                <Icon
                  className="size-4 text-muted-foreground transition-colors duration-300 group-hover:text-brand"
                  aria-hidden
                />
              </span>

              <span
                aria-hidden
                className="font-mono text-[0.625rem] tracking-[0.16em] text-muted-foreground/40 transition-colors duration-300 group-hover:text-brand/60"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>

            <h3 className="mt-6 text-sm font-semibold tracking-tight text-foreground">
              {label}
            </h3>

            <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
              {desc}
            </p>
          </article>
        ))}
      </div>
    </Section>
  );
}

export default Features;
