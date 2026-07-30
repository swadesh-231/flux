/**
 * The atmosphere layered over the starfield: a gold bloom rising off the
 * horizon, the lit horizon line itself, and a fade that sets the hero down on
 * the page background.
 *
 * Pure CSS, so this stays a server component — only the stars themselves need
 * the client, for the mouse parallax.
 */
export function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {/* The light source. Drifts slowly enough to notice only on second look. */}
      <div className="hero-bloom absolute inset-x-[-15%] bottom-0 top-1/3 animate-drift motion-reduce:animate-none" />

      {/* Horizon: one lit hairline where the hero meets the page. */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-brand/35 to-transparent" />

      {/* Lands the starfield on the sections below. */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-b from-transparent to-background" />
    </div>
  );
}

export default HeroBackdrop;
