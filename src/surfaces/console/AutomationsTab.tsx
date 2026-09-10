import React from "react";
import { useFridayStore } from "@/lib/store";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Clock, Zap, Play, CheckCircle2, XCircle } from "lucide-react";

export const AutomationsTab: React.FC = () => {
  const { automations, toggleAutomation } = useFridayStore();

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[var(--text-head)] font-semibold text-[var(--color-text)]">
            Automations & Scheduler
          </h2>
          <p className="text-[var(--text-micro)] text-[var(--color-mute)]">
            Cron schedules, background file watchers, and speech triggers running in Rust runtime.
          </p>
        </div>
        <Button variant="secondary" size="sm">
          + New Automation
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Automation</TableHead>
            <TableHead>Trigger</TableHead>
            <TableHead>Action Summary</TableHead>
            <TableHead>Last Executed</TableHead>
            <TableHead className="text-right">State</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {automations.map((auto) => (
            <TableRow key={auto.id}>
              <TableCell className="font-medium text-[var(--color-text)]">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[var(--color-acid)]" />
                  <span>{auto.name}</span>
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs text-[var(--color-mute)]">
                {auto.triggerExpr}
              </TableCell>
              <TableCell className="text-xs text-[var(--color-text)]">
                {auto.actionSummary}
              </TableCell>
              <TableCell className="font-mono text-xs text-[var(--color-mute)]">
                {auto.lastRun ? new Date(auto.lastRun).toLocaleString() : "Never"}
              </TableCell>
              <TableCell className="text-right">
                <button
                  onClick={() => toggleAutomation(auto.id)}
                  className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                    auto.enabled
                      ? "bg-[oklch(78%_0.19_152_/_0.15)] text-[var(--color-acid)] border border-[oklch(78%_0.19_152_/_0.3)]"
                      : "bg-[var(--color-plate)] text-[var(--color-mute)] border border-[var(--color-edge)]"
                  }`}
                >
                  {auto.enabled ? "Active" : "Paused"}
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
