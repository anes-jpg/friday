import React from "react";
import { Card } from "./Card";
import { Tracker, TrackerBlockProps } from "./Tracker";
import { TremorBadge } from "./Badge";
import { Zap, Activity } from "lucide-react";

export interface PipelineStage {
  name: string;
  measured: number;
  budget: number;
  status: "pass" | "warn" | "fail";
}

export const StatusMonitoring: React.FC<{ stages: PipelineStage[] }> = ({ stages }) => {
  const trackerData: TrackerBlockProps[] = stages.map((s) => ({
    key: s.name,
    color:
      s.status === "pass"
        ? "bg-[var(--color-acid)]"
        : s.status === "warn"
        ? "bg-[var(--color-warn)]"
        : "bg-[var(--color-fail)]",
    tooltip: `${s.name}: ${s.measured}ms / Budget: ≤${s.budget}ms`,
    hoverEffect: true,
  }));

  const totalMeasured = stages.reduce((acc, s) => acc + s.measured, 0);

  return (
    <Card className="p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text)]">
          <Activity className="w-3.5 h-3.5 text-[var(--color-acid)]" />
          <span>Pipeline Latency Stages (§04 Budget)</span>
        </div>
        <TremorBadge variant={totalMeasured <= 1800 ? "success" : "warning"}>
          {totalMeasured}ms total
        </TremorBadge>
      </div>

      <Tracker data={trackerData} />

      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-[var(--color-mute)] pt-1 border-t border-[var(--color-edge)]">
        <div>Non-verbal ack: &le;150ms</div>
        <div>Recognition tail: &le;250ms</div>
        <div>Router kNN: &le;15ms</div>
        <div>End-to-End: &le;1.8s p95</div>
      </div>
    </Card>
  );
};
