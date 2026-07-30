import { Section, SectionHeader } from "@/components/reusables";
import { STEPS } from "@/lib/data";

/**
 * Editorial two-column layout: the heading stays put while the steps scroll
 * past it. Numbers sit in their own gutter, separated by hairlines instead of
 * the usual bubble-and-connector timeline.
 */
export function Workflow() {
  return (
    <Section id="workflow">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-24">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <SectionHeader
            align="start"
            eyebrow="How it works"
            title="Four steps, and"
            accent="then it's yours."
            lead="No setup, no scaffolding decisions, no configuration to inherit."
          />
        </div>

        <ol className="divide-y divide-border">
          {STEPS.map((step) => (
            <li
              key={step.number}
              className="grid grid-cols-[2rem_1fr] gap-5 py-8 first:pt-0 last:pb-0 sm:grid-cols-[3rem_1fr] sm:gap-8"
            >
              <span
                aria-hidden
                className="pt-1 font-mono text-[0.6875rem] tracking-[0.18em] text-muted-foreground/45"
              >
                {step.number}
              </span>

              <div>
                <h3 className="text-base font-medium tracking-tight text-foreground">
                  {step.label}
                </h3>

                <p className="mt-2.5 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground">
                  {step.desc}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}

export default Workflow;
