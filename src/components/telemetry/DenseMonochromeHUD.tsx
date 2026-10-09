import React, { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  Sliders,
  Search,
  ChevronDown,
  Layers,
  Radio,
  FileText,
  Settings,
  Grid,
  TrendingUp,
  ShieldAlert,
  Cpu,
  User,
  CheckCircle2,
} from "lucide-react";

interface DenseMonochromeHUDProps {
  className?: string;
  onResolve?: () => void;
}

export const DenseMonochromeHUD: React.FC<DenseMonochromeHUDProps> = ({
  className,
  onResolve,
}) => {
  const [activeNav, setActiveNav] = useState("insights");
  const [feedTab, setFeedTab] = useState<"insights" | "team">("insights");

  return (
    <div
      className={cn(
        "flex flex-col w-full bg-black text-white font-mono select-none overflow-hidden rounded-2xl border border-white/20 shadow-2xl relative",
        className
      )}
    >
      {/* Background Micro Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* TOP NAVIGATION BAR */}
      <header className="flex items-center justify-between px-4 py-2 bg-black/80 border-b border-white/15 z-10 text-xs">
        <div className="flex items-center gap-1">
          <button className="p-1.5 hover:bg-white/10 rounded transition-colors text-zinc-400 hover:text-white">
            <Grid className="w-4 h-4" />
          </button>

          <div className="h-4 w-[1px] bg-white/20 mx-1" />

          <nav className="flex items-center gap-1">
            {[
              { id: "insights", label: "Insights", icon: <TrendingUp className="w-3.5 h-3.5" /> },
              { id: "signals", label: "Signals", icon: <Radio className="w-3.5 h-3.5" /> },
              { id: "entities", label: "Entities", icon: <Layers className="w-3.5 h-3.5" /> },
              { id: "investigations", label: "Investigations", icon: <ShieldAlert className="w-3.5 h-3.5" /> },
              { id: "content", label: "Content", icon: <FileText className="w-3.5 h-3.5" /> },
              { id: "configuration", label: "Configuration", icon: <Settings className="w-3.5 h-3.5" /> },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded text-[11px] uppercase tracking-wider transition-colors",
                  activeNav === item.id
                    ? "bg-white/15 text-white font-bold border border-white/20"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          <button className="p-1.5 hover:bg-white/10 rounded transition-colors text-zinc-400 hover:text-white">
            <Search className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-2 pl-2 border-l border-white/15">
            <div className="w-5 h-5 rounded-full bg-zinc-800 border border-white/30 flex items-center justify-center text-[10px]">
              <User className="w-3 h-3 text-zinc-300" />
            </div>
            <span className="text-[11px] text-zinc-300 font-medium">Austin M.</span>
            <ChevronDown className="w-3 h-3 text-zinc-500" />
          </div>
        </div>
      </header>

      {/* MAIN TELEMETRY GRID */}
      <div className="grid grid-cols-12 gap-3 p-4 flex-1 overflow-y-auto relative z-10">
        
        {/* LEFT & CENTER COLUMN (9 Cols) */}
        <div className="col-span-12 lg:col-span-9 flex flex-col gap-3">
          
          {/* ROW 1: Dashboard Header + Records + Signals */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Dashboard Title Card */}
            <div className="relative bg-zinc-950/80 border border-white/15 p-4 rounded-lg flex flex-col justify-between">
              <div className="absolute top-1 left-1 text-[8px] text-zinc-600">┌</div>
              <div className="absolute top-1 right-1 text-[8px] text-zinc-600">┐</div>
              <div className="absolute bottom-1 left-1 text-[8px] text-zinc-600">└</div>
              <div className="absolute bottom-1 right-1 text-[8px] text-zinc-600">┘</div>

              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">Dashboard //</span>
                <h3 className="text-sm font-bold text-white tracking-wider mt-0.5">Friday-September_13</h3>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--color-acid)] animate-pulse" />
                <span className="text-[10px] text-zinc-400 tracking-wider">ALL_SYSTEMS_OPERATIONAL</span>
              </div>
            </div>

            {/* Records Card */}
            <div className="relative bg-zinc-950/80 border border-white/15 p-4 rounded-lg">
              <div className="absolute top-1 left-1 text-[8px] text-zinc-600">┌</div>
              <div className="absolute top-1 right-1 text-[8px] text-zinc-600">┐</div>
              <div className="absolute bottom-1 left-1 text-[8px] text-zinc-600">└</div>
              <div className="absolute bottom-1 right-1 text-[8px] text-zinc-600">┘</div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest">RECORDS</span>
                  <div className="text-xl font-bold text-white tracking-tight">35.51m</div>
                  <span className="text-[9px] text-zinc-400 tracking-wider">LIVE</span>
                </div>
                <div className="w-6 h-6 border border-white/20 rounded-full flex items-center justify-center text-zinc-400">
                  <Activity className="w-3.5 h-3.5 text-[var(--color-acid)]" />
                </div>
              </div>

              {/* Smooth Curve SVG */}
              <div className="h-10 mt-2 w-full">
                <svg className="w-full h-full" viewBox="0 0 200 40" preserveAspectRatio="none">
                  <path
                    d="M 0 35 Q 50 30, 80 15 T 140 20 T 200 10"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M 0 35 Q 50 30, 80 15 T 140 20 T 200 10 L 200 40 L 0 40 Z"
                    fill="rgba(255, 255, 255, 0.05)"
                  />
                </svg>
              </div>
              <div className="text-[8px] text-zinc-600 text-right tracking-widest mt-1">LAST_14_DAYS</div>
            </div>

            {/* Signals Card */}
            <div className="relative bg-zinc-950/80 border border-white/15 p-4 rounded-lg">
              <div className="absolute top-1 left-1 text-[8px] text-zinc-600">┌</div>
              <div className="absolute top-1 right-1 text-[8px] text-zinc-600">┐</div>
              <div className="absolute bottom-1 left-1 text-[8px] text-zinc-600">└</div>
              <div className="absolute bottom-1 right-1 text-[8px] text-zinc-600">┘</div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest">SIGNALS</span>
                  <div className="text-xl font-bold text-white tracking-tight">102.2k</div>
                  <span className="text-[9px] text-zinc-400 tracking-wider">LIVE</span>
                </div>
                <div className="w-6 h-6 border border-white/20 rounded-full flex items-center justify-center text-zinc-400">
                  <Sliders className="w-3.5 h-3.5 text-white" />
                </div>
              </div>

              {/* Peak Curve SVG */}
              <div className="h-10 mt-2 w-full">
                <svg className="w-full h-full" viewBox="0 0 200 40" preserveAspectRatio="none">
                  <path
                    d="M 0 38 Q 60 38, 100 8 T 160 30 T 200 35"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M 0 38 Q 60 38, 100 8 T 160 30 T 200 35 L 200 40 L 0 40 Z"
                    fill="rgba(255, 255, 255, 0.05)"
                  />
                </svg>
              </div>
              <div className="text-[8px] text-zinc-600 text-right tracking-widest mt-1">LAST_14_DAYS</div>
            </div>
          </div>

          {/* ROW 2: Entities & Signals Over Time (Left) + Insights & Radar (Right) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            
            {/* Left Sub-column (4 Cols): Entities & Wave chart */}
            <div className="md:col-span-4 flex flex-col gap-3">
              {/* Entities Card */}
              <div className="relative bg-zinc-950/80 border border-white/15 p-4 rounded-lg">
                <div className="absolute top-1 left-1 text-[8px] text-zinc-600">┌</div>
                <div className="absolute top-1 right-1 text-[8px] text-zinc-600">┐</div>
                <div className="absolute bottom-1 left-1 text-[8px] text-zinc-600">└</div>
                <div className="absolute bottom-1 right-1 text-[8px] text-zinc-600">┘</div>

                <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-3">ENTITIES</span>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-lg font-bold text-white">1.2k</div>
                    <div className="text-[8px] text-zinc-400 uppercase leading-tight mt-0.5">
                      ACTIVE_USERS<br />IN_24_HOURS
                    </div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">3.7k</div>
                    <div className="text-[8px] text-zinc-400 uppercase leading-tight mt-0.5">
                      ACTIVE_DEVICES<br />IN_24_HOURS
                    </div>
                  </div>
                </div>
              </div>

              {/* Signals Over Time Card */}
              <div className="relative bg-zinc-950/80 border border-white/15 p-4 rounded-lg flex-1">
                <div className="absolute top-1 left-1 text-[8px] text-zinc-600">┌</div>
                <div className="absolute top-1 right-1 text-[8px] text-zinc-600">┐</div>
                <div className="absolute bottom-1 left-1 text-[8px] text-zinc-600">└</div>
                <div className="absolute bottom-1 right-1 text-[8px] text-zinc-600">┘</div>

                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest">SIGNALS_OVER_TIME</span>
                  <span className="text-[8px] text-zinc-500">LIVE 14_DAYS</span>
                </div>

                {/* Triple Wave SVG */}
                <div className="h-28 w-full">
                  <svg className="w-full h-full" viewBox="0 0 200 80" preserveAspectRatio="none">
                    {/* Background grid lines */}
                    <line x1="0" y1="20" x2="200" y2="20" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                    <line x1="0" y1="40" x2="200" y2="40" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                    <line x1="0" y1="60" x2="200" y2="60" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

                    {/* Wave 1: Anomaly */}
                    <path
                      d="M 0 70 Q 30 65, 50 30 T 100 60 T 150 15 T 200 70"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    {/* Wave 2: Pattern */}
                    <path
                      d="M 0 75 Q 40 70, 70 45 T 120 40 T 170 30 T 200 75"
                      fill="none"
                      stroke="rgba(255,255,255,0.6)"
                      strokeWidth="1.2"
                    />
                    {/* Wave 3: Third Party */}
                    <path
                      d="M 0 78 Q 20 75, 60 60 T 110 65 T 160 50 T 200 78"
                      fill="none"
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth="1"
                    />
                  </svg>
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 gap-1 text-[8px] text-zinc-500 uppercase mt-2">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    <span>Anomaly</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                    <span>Pattern</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                    <span>Threat Intel</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-acid)]" />
                    <span>Third Party</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Sub-column (8 Cols): Insights Chart & Threat Radar */}
            <div className="md:col-span-8 relative bg-zinc-950/80 border border-white/15 p-4 rounded-lg flex flex-col justify-between">
              <div className="absolute top-1 left-1 text-[8px] text-zinc-600">┌</div>
              <div className="absolute top-1 right-1 text-[8px] text-zinc-600">┐</div>
              <div className="absolute bottom-1 left-1 text-[8px] text-zinc-600">└</div>
              <div className="absolute bottom-1 right-1 text-[8px] text-zinc-600">┘</div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest">INSIGHTS</span>
                    <span className="text-xl font-bold text-white">08</span>
                    <span className="text-[9px] text-zinc-500 uppercase">NEW_IN_24_HOURS</span>
                  </div>
                  <button className="text-[9px] uppercase tracking-wider text-zinc-400 hover:text-white border border-white/20 px-2 py-0.5 rounded">
                    VIEW ALL
                  </button>
                </div>

                {/* Connected Scatter / Line Chart */}
                <div className="h-28 w-full mt-2">
                  <svg className="w-full h-full" viewBox="0 0 300 80" preserveAspectRatio="none">
                    <path
                      d="M 10 70 L 60 50 L 110 65 L 160 20 L 210 55 L 260 50 L 290 68"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    {/* Data Points */}
                    {[
                      { x: 10, y: 70 },
                      { x: 60, y: 50 },
                      { x: 110, y: 65 },
                      { x: 160, y: 20 },
                      { x: 210, y: 55 },
                      { x: 260, y: 50 },
                      { x: 290, y: 68 },
                    ].map((pt, idx) => (
                      <circle
                        key={idx}
                        cx={pt.x}
                        cy={pt.y}
                        r="3.5"
                        fill="#ffffff"
                        stroke="#000000"
                        strokeWidth="1.5"
                      />
                    ))}
                  </svg>
                </div>
              </div>

              {/* Threat Detail & Radar Chart Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/10">
                <div className="flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Increased Traffic with Endpoint Threat
                    </h4>
                    <p className="text-[10px] text-zinc-400 leading-relaxed mt-1">
                      Models show an increase of HTTP traffic after a brute force attack sequence.
                    </p>
                    <div className="flex items-center gap-3 text-[8px] text-zinc-500 uppercase tracking-widest mt-2">
                      <span>1_DAY_AGO</span>
                      <span>3_UNIQUE_SIGNALS</span>
                    </div>
                  </div>

                  <button
                    onClick={onResolve}
                    className="mt-3 w-fit px-4 py-1.5 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded hover:bg-zinc-200 transition-colors cursor-pointer"
                  >
                    RESOLVE
                  </button>
                </div>

                {/* Radar Chart */}
                <div className="flex flex-col items-center justify-center">
                  <div className="text-[8px] text-zinc-500 uppercase tracking-widest self-start mb-1">
                    SEVERITY_RADAR
                  </div>
                  <div className="w-32 h-32 relative">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      {/* Concentric Polygons */}
                      <polygon
                        points="50,15 80,45 65,85 35,85 20,45"
                        fill="none"
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth="1"
                      />
                      <polygon
                        points="50,25 72,48 60,75 40,75 28,48"
                        fill="none"
                        stroke="rgba(255,255,255,0.2)"
                        strokeWidth="1"
                      />
                      <polygon
                        points="50,35 64,51 55,65 45,65 36,51"
                        fill="none"
                        stroke="rgba(255,255,255,0.25)"
                        strokeWidth="1"
                      />

                      {/* Axes */}
                      <line x1="50" y1="50" x2="50" y2="15" stroke="rgba(255,255,255,0.2)" />
                      <line x1="50" y1="50" x2="80" y2="45" stroke="rgba(255,255,255,0.2)" />
                      <line x1="50" y1="50" x2="65" y2="85" stroke="rgba(255,255,255,0.2)" />
                      <line x1="50" y1="50" x2="35" y2="85" stroke="rgba(255,255,255,0.2)" />
                      <line x1="50" y1="50" x2="20" y2="45" stroke="rgba(255,255,255,0.2)" />

                      {/* Active Threat Signature Polygon */}
                      <polygon
                        points="50,18 76,46 58,80 38,82 22,46"
                        fill="rgba(255,255,255,0.15)"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ROW 3: Sensors Equalizer Bar Chart */}
          <div className="relative bg-zinc-950/80 border border-white/15 p-4 rounded-lg">
            <div className="absolute top-1 left-1 text-[8px] text-zinc-600">┌</div>
            <div className="absolute top-1 right-1 text-[8px] text-zinc-600">┐</div>
            <div className="absolute bottom-1 left-1 text-[8px] text-zinc-600">└</div>
            <div className="absolute bottom-1 right-1 text-[8px] text-zinc-600">┘</div>

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest">SENSORS</span>
                <span className="text-xs font-bold text-white">10</span>
                <span className="text-xs text-[var(--color-acid)]">3 ACTIVE</span>
              </div>
              <div className="text-[8px] text-zinc-500 tracking-widest">1 / 2 // 3 // 4 // 5 // 6 // 7</div>
            </div>

            {/* Equalizer Bars */}
            <div className="flex items-end justify-between gap-1 h-12 px-2 py-1 bg-black/60 rounded border border-white/10">
              {[4, 8, 12, 16, 24, 32, 28, 20, 14, 22, 38, 44, 30, 18, 12, 8, 14, 26, 36, 40, 28, 16, 10, 6].map(
                (h, idx) => (
                  <div
                    key={idx}
                    className="flex-1 bg-white hover:bg-[var(--color-acid)] transition-all rounded-[1px]"
                    style={{ height: `${h}px` }}
                  />
                )
              )}
            </div>

            {/* Sensor Statuses */}
            <div className="grid grid-cols-3 gap-2 text-[9px] text-zinc-400 uppercase mt-3">
              <div className="flex items-center justify-between bg-black/40 border border-white/5 p-1.5 rounded">
                <span>NAME // Windows_Sensor</span>
                <span className="text-amber-400 font-bold">Warning</span>
              </div>
              <div className="flex items-center justify-between bg-black/40 border border-white/5 p-1.5 rounded">
                <span>NAME // asr-sensor</span>
                <span className="text-emerald-400 font-bold">Ok</span>
              </div>
              <div className="flex items-center justify-between bg-black/40 border border-white/5 p-1.5 rounded">
                <span>NAME // glm_stream</span>
                <span className="text-emerald-400 font-bold">Ok</span>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN (3 Cols): ACTIVITY FEED */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-2 relative bg-zinc-950/80 border border-white/15 p-4 rounded-lg">
          <div className="absolute top-1 left-1 text-[8px] text-zinc-600">┌</div>
          <div className="absolute top-1 right-1 text-[8px] text-zinc-600">┐</div>
          <div className="absolute bottom-1 left-1 text-[8px] text-zinc-600">└</div>
          <div className="absolute bottom-1 right-1 text-[8px] text-zinc-600">┘</div>

          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest">ACTIVITY FEED</span>
            <div className="flex items-center gap-1 text-[9px]">
              <button
                onClick={() => setFeedTab("insights")}
                className={cn(
                  "px-2 py-0.5 rounded uppercase tracking-wider",
                  feedTab === "insights" ? "bg-white text-black font-bold" : "text-zinc-500 hover:text-white"
                )}
              >
                INSIGHTS
              </button>
              <button
                onClick={() => setFeedTab("team")}
                className={cn(
                  "px-2 py-0.5 rounded uppercase tracking-wider",
                  feedTab === "team" ? "bg-white text-black font-bold" : "text-zinc-500 hover:text-white"
                )}
              >
                TEAM
              </button>
            </div>
          </div>

          {/* Feed Items */}
          <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto pr-1">
            {[
              {
                title: "Insider_Threat // Lateral_Movement_with_Increased_Traffic",
                time: "30_minutes_ago",
                desc: "New_Insight_created",
              },
              {
                title: "Authentication_Spike // Failed_Logins_Threshold",
                time: "45_minutes_ago",
                desc: "Anomaly_detected_in_cluster",
              },
              {
                title: "Process_Injection // Untrusted_DLL_Loaded",
                time: "1_hour_ago",
                desc: "Endpoint_quarantine_advised",
              },
              {
                title: "Outbound_Beacon // C2_Heuristic_Match",
                time: "2_hours_ago",
                desc: "Firewall_rule_applied",
              },
              {
                title: "Privilege_Escalation // Token_Impersonation",
                time: "3_hours_ago",
                desc: "Audited_by_operator",
              },
            ].map((feed, idx) => (
              <div
                key={idx}
                className="p-2.5 bg-black/60 border border-white/10 rounded hover:border-white/30 transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[var(--color-acid)] transition-colors mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-white leading-tight break-words">
                      {feed.title}
                    </div>
                    <div className="text-[8px] text-zinc-500 tracking-wider mt-1">
                      {feed.time}
                    </div>
                    <div className="text-[8px] text-zinc-400 tracking-wider mt-0.5">
                      {feed.desc}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
