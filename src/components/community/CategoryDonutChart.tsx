export function CategoryDonutChart() {
  // Segments matching the visual donut:
  // Just Chatting 45% (pink/red), Gaming 32% (blue), Music 13% (purple), IRL 7% (yellow), Other 3% (zinc/gray)
  const segments = [
    { label: "Just Chatting", percent: 45, color: "#f43f5e", strokeDash: "141.37 314.15", strokeDashOffset: "0" },
    { label: "Gaming", percent: 32, color: "#0ea5e9", strokeDash: "100.53 314.15", strokeDashOffset: "-141.37" },
    { label: "Music", percent: 13, color: "#8b5cf6", strokeDash: "40.84 314.15", strokeDashOffset: "-241.9" },
    { label: "IRL", percent: 7, color: "#eab308", strokeDash: "21.99 314.15", strokeDashOffset: "-282.74" },
    { label: "Other", percent: 3, color: "#475569", strokeDash: "9.42 314.15", strokeDashOffset: "-304.73" },
  ];

  return (
    <div className="flex items-center gap-6">
      {/* SVG Donut */}
      <div className="relative h-28 w-28 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          {/* Background circle track */}
          <circle
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke="#1a1d2d"
            strokeWidth="14"
          />
          {/* Segments */}
          {segments.map((seg, idx) => (
            <circle
              key={idx}
              cx="60"
              cy="60"
              r="48"
              fill="none"
              stroke={seg.color}
              strokeWidth="14"
              strokeDasharray={seg.strokeDash}
              strokeDashoffset={seg.strokeDashOffset}
              className="transition-all duration-300 hover:opacity-80"
            />
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#f43f5e]" />
          <span className="text-zinc-300">Just Chatting</span>
          <span className="ml-auto font-bold text-emerald-400">45%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#0ea5e9]" />
          <span className="text-zinc-300">Gaming</span>
          <span className="ml-auto font-bold text-zinc-400">45%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#8b5cf6]" />
          <span className="text-zinc-300">Music</span>
          <span className="ml-auto font-bold text-zinc-400"></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#eab308]" />
          <span className="text-zinc-300">IRL</span>
          <span className="ml-auto font-bold text-emerald-400">7%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#475569]" />
          <span className="text-zinc-300">Other</span>
          <span className="ml-auto font-bold text-emerald-400">3%</span>
        </div>
      </div>
    </div>
  );
}
