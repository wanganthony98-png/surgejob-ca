type LogoVariant = "onDark" | "onLight";

export function Logo({
  variant = "onLight",
  compact = false,
  className = "",
}: {
  variant?: LogoVariant;
  compact?: boolean;
  className?: string;
}) {
  const onDark = variant === "onDark";

  return (
    <span className={`flex items-center gap-3 ${className}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500 shadow-sm sm:h-10 sm:w-10">
        <SurgeMark className="h-5 w-5 text-white sm:h-6 sm:w-6" />
      </span>
      <span className="min-w-0 text-left leading-tight">
        <span className="flex items-baseline">
          <span
            className={`font-black ${
              compact ? "text-base tracking-wider sm:text-lg sm:tracking-widest" : "text-lg tracking-widest"
            } ${onDark ? "text-white" : "text-slate-900"}`}
          >
            SURGEJOB
          </span>
          <span
            className={`bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text font-black text-transparent ${
              compact ? "text-base tracking-wider sm:text-lg sm:tracking-widest" : "text-lg tracking-widest"
            }`}
          >
            .ca
          </span>
        </span>
        <span
          className={`block text-xs font-medium uppercase tracking-wider ${
            compact ? "hidden sm:block" : ""
          } ${onDark ? "text-slate-400" : "text-slate-500"}`}
        >
          Data-Driven Career Engine
        </span>
      </span>
    </span>
  );
}

function SurgeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <path
        d="M5 23.5c3.2.2 4.6-4.8 7.4-7.2 2.6-2.2 3.6 3.6 6.6 2.2 2.2-1 3.4-4.2 4.6-6.4"
        stroke="currentColor"
        strokeWidth="2.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.2 14.6 26.6 6.2"
        stroke="currentColor"
        strokeWidth="2.55"
        strokeLinecap="round"
      />
      <path
        d="M19.6 6.2h7.2v7.2"
        stroke="currentColor"
        strokeWidth="2.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
