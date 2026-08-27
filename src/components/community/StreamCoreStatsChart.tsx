import { useId } from "react";

export function StreamCoreStatsChart() {
  const gradientId = useId();

  // Smooth undulating wave matching the reference graph
  const pathD = "M 0,35 Q 25,12 45,30 T 90,18 T 135,38 T 180,12 T 225,28 T 260,10 L 260,60 L 0,60 Z";
  const lineD = "M 0,35 Q 25,12 45,30 T 90,18 T 135,38 T 180,12 T 225,28 T 260,10";

  return (
    <div className="relative h-20 w-full overflow-hidden">
      <svg
        viewBox="0 0 260 60"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#6366f1" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
          </linearGradient>
          <filter id={`glow-${gradientId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Fill under the curve */}
        <path d={pathD} fill={`url(#${gradientId})`} />

        {/* Glowing stroke line */}
        <path
          d={lineD}
          fill="none"
          stroke="#818cf8"
          strokeWidth="2.5"
          strokeLinecap="round"
          filter={`url(#glow-${gradientId})`}
        />
      </svg>
    </div>
  );
}
