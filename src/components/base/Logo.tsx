import { cn } from "@/lib/utils";

export function FluxMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="presentation"
      className={cn("h-7 w-7", className)}
    >
      {/* Chevrons — butt caps and mitred joins keep the geometric, squared-off feel */}
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={3.1}
        strokeLinecap="butt"
        strokeLinejoin="miter"
      >
        <path d="M8.2 12.4 L4.6 16.6 L8.2 20.8" />
        <path d="M23.8 12.4 L27.4 16.6 L23.8 20.8" />
      </g>
      {/* The 'f', including the chamfered shoulder of the original */}
      <path
        fill="currentColor"
        d="M13.2 25.6 L13.2 15.2 L11.2 15.2 L11.2 12 L13.2 12 L13.2 9.9 L15.7 6.4 L20.4 6.4 L20.4 9.6 L16.4 9.6 L16.4 12 L18.4 12 L18.4 15.2 L16.4 15.2 L16.4 25.6 Z"
      />
    </svg>
  );
}

/**
 * Full lockup: monogram plus wordmark. Hide the wordmark on narrow screens by
 * passing `wordmarkClassName="hidden sm:block"`.
 */
export function Logo({
  className,
  wordmarkClassName,
}: {
  className?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <FluxMark className="h-7 w-7 shrink-0" />
      <span
        className={cn(
          "text-[15px] font-semibold tracking-tight leading-none",
          wordmarkClassName,
        )}
      >
        flux
      </span>
    </span>
  );
}

export default Logo;
