import React from "react";
import { useFridayStore } from "@/lib/store";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ShieldCheck, Download, Filter } from "lucide-react";

export const AuditTab: React.FC = () => {
  const { auditLog } = useFridayStore();

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[var(--text-head)] font-semibold text-[var(--color-text)]">
            Security Audit Log (Append-Only)
          </h2>
          <p className="text-[var(--text-micro)] text-[var(--color-mute)]">
            Every tool invocation, risk tier authorization, and execution hash recorded into SQLite.
          </p>
        </div>
        <Button variant="secondary" size="sm">
          <Download className="w-3.5 h-3.5 mr-1" />
          Export JSON
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Timestamp</TableHead>
            <TableHead>Tool Invoked</TableHead>
            <TableHead>Risk Tier</TableHead>
            <TableHead>Parameters Hash</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead className="text-right">Decision</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {auditLog.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="font-mono text-xs text-[var(--color-mute)]">
                {new Date(log.timestamp).toLocaleTimeString()}
              </TableCell>
              <TableCell className="font-mono font-medium text-[var(--color-text)]">
                {log.toolName}
              </TableCell>
              <TableCell>
                <Badge tier={log.tier} size="sm" />
              </TableCell>
              <TableCell className="font-mono text-xs text-[var(--color-mute)]">
                {log.argsHash}
              </TableCell>
              <TableCell className="font-mono text-xs text-[var(--color-text)]">
                {log.durationMs}ms
              </TableCell>
              <TableCell className="text-right">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                    log.decision === "allowed"
                      ? "text-[var(--color-acid)] bg-[oklch(78%_0.19_152_/_0.1)]"
                      : log.decision === "confirmed"
                      ? "text-[var(--color-warn)] bg-[oklch(72%_0.17_62_/_0.1)]"
                      : "text-[var(--color-fail)] bg-[oklch(63%_0.21_25_/_0.1)]"
                  }`}
                >
                  {log.decision}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
