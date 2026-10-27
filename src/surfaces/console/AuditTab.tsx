import React, { useState } from "react"
import { useFridayStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { ScrollText, Download, Filter, Shield, AlertTriangle, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  WatermelonBentoCard,
  WatermelonStatusBadge,
  MagneticSelect,
  normalizeAuditEntry,
  formatAuditTimestamp,
} from "./BenchoWatermelonPrimitives"

export const AuditTab: React.FC = () => {
  const { audit } = useFridayStore()
  const [filterTier, setFilterTier] = useState<string>("ALL")
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null)

  const filteredLogs = audit.filter((log) => {
    if (filterTier.toLowerCase() === "all") return true
    return (log.tier || "").toLowerCase() === filterTier.toLowerCase()
  })

  const selectedLog = audit.find((l) => l.id === selectedAuditId) || null

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(audit, null, 2))
    const downloadAnchor = document.createElement("a")
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", `friday_audit_receipts_${new Date().toISOString().slice(0, 10)}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  return (
    <div className="legacy-workspace flex-1 flex flex-col h-full bg-[hsl(var(--surface))] text-[hsl(var(--ink))] p-6 overflow-hidden select-none">
      {/* Standard Page Header */}
      <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4 mb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <ScrollText className="size-4 text-[hsl(var(--ink))]" />
            <h2 className="page-heading">
              Activity audit
            </h2>

          </div>
          <p className="font-instrument text-[11px] text-[hsl(var(--muted))] mt-1">
            Cryptographic ledger of tool invocations, confirmations, and security decisions.
          </p>
        </div>

        <Button
          size="sm"
          onClick={handleExport}
          className="font-instrument text-xs bg-[hsl(var(--surface-raised))] border border-black/10 dark:border-white/10 text-[hsl(var(--ink))] hover:border-[hsl(var(--ink))] cursor-pointer gap-1.5"
        >
          <Download className="size-3.5" />
          Export JSON
        </Button>
      </div>

      {/* Sticky Filter Bar with Bencho MagneticSelect */}
      <div className="flex items-center gap-3 mb-4 shrink-0 font-instrument text-xs">
        <div className="flex items-center gap-1.5 text-[hsl(var(--muted))]">
          <Filter className="size-3.5" />
          <span>Filter:</span>
        </div>
        <MagneticSelect
          options={["ALL", "GREEN", "AMBER", "RED"]}
          value={filterTier}
          onChange={setFilterTier}
          accent="white"
        />
      </div>

      {/* Main Table / Detail Split */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Table / Timeline Hybrid in WatermelonBentoCard */}
        <WatermelonBentoCard className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-2.5 border-b border-black/10 dark:border-white/10 font-instrument text-[10px] uppercase tracking-[.11em] text-[hsl(var(--muted))] shrink-0 bg-zinc-950/40">
            <span className="col-span-2">Time</span>
            <span className="col-span-3">Action / Tool</span>
            <span className="col-span-2">Risk Tier</span>
            <span className="col-span-3">Parameters Hash</span>
            <span className="col-span-2 text-right">Outcome</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-black/5 dark:divide-white/5 font-instrument text-xs">
            {filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-[hsl(var(--muted))]">
                No audit logs found for the selected filter.
              </div>
            ) : (
              filteredLogs.map((entry, idx) => {
                const row = normalizeAuditEntry(entry, idx)
                const isSelected = selectedAuditId === row.id
                return (
                  <div
                    key={row.id}
                    onClick={() => setSelectedAuditId(row.id)}
                    className={cn(
                      "grid grid-cols-12 items-center px-4 py-3 cursor-pointer transition-colors",
                      isSelected
                        ? "bg-[hsl(var(--ink))]/10"
                        : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                    )}
                  >
                    <span className="col-span-2 text-[hsl(var(--muted))] tabular-telemetry">
                      {row.formattedTime}
                    </span>
                    <span className="col-span-3 font-semibold text-[hsl(var(--ink))] truncate pr-2">
                      {row.toolName}
                    </span>
                    <span className="col-span-2 flex items-center gap-1.5">
                      {row.tier === "Green" ? (
                        <Shield className="size-3 text-[hsl(var(--success))]" />
                      ) : row.tier === "Amber" ? (
                        <AlertTriangle className="size-3 text-[hsl(var(--warning))]" />
                      ) : (
                        <ShieldAlert className="size-3 text-[hsl(var(--danger))]" />
                      )}
                      <span className="capitalize">{row.tier}</span>
                    </span>
                    <span className="col-span-3 text-[hsl(var(--muted))] truncate font-mono text-[11px]">
                      {row.argsHash}
                    </span>
                    <span className="col-span-2 text-right">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tabular-telemetry",
                          row.decision.includes("ESCALAT")
                            ? "bg-[hsl(var(--ink))]/10 text-[hsl(var(--ink))]"
                            : row.decision.includes("CONFIRM")
                            ? "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]"
                            : "bg-black/5 dark:bg-white/10 text-[hsl(var(--muted))]"
                        )}
                      >
                        {row.decision}
                      </span>
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </WatermelonBentoCard>

        {/* Selected Receipt Detail Inspector */}
        {selectedLog && (
          <WatermelonBentoCard className="w-[320px] shrink-0 p-4 font-instrument text-xs flex flex-col min-h-0 overflow-y-auto space-y-3">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--ink))]">
                Receipt #{selectedLog.id.slice(0, 8)}
              </span>
              <span className="text-[hsl(var(--muted))] tabular-telemetry">{selectedLog.durationMs}ms</span>
            </div>

            <div>
              <span className="text-[10px] text-[hsl(var(--muted))] block">INVOKED TOOL</span>
              <span className="font-semibold text-sm text-[hsl(var(--ink))]">{selectedLog.toolName}</span>
            </div>

            <div>
              <span className="text-[10px] text-[hsl(var(--muted))] block">RISK EVALUATION</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-semibold uppercase",
                  (selectedLog.tier || "").toLowerCase() === "green" ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" :
                  (selectedLog.tier || "").toLowerCase() === "amber" ? "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]" :
                  "bg-[hsl(var(--danger))]/10 text-[hsl(var(--danger))]"
                )}>
                  {selectedLog.tier} tier
                </span>
                <span className="text-[hsl(var(--muted))]">{selectedLog.decision}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-[hsl(var(--muted))] block">PAYLOAD HASH</span>
              <pre className="mt-1 p-2 rounded bg-zinc-950/60 border border-black/10 dark:border-white/10 text-[10px] text-[hsl(var(--ink))] overflow-x-auto">
                {selectedLog.argsHash}
              </pre>
            </div>

            <div className="pt-2 border-t border-black/10 dark:border-white/10 text-[10px] text-[hsl(var(--muted))]">
              Auditable timestamp: {formatAuditTimestamp(selectedLog.timestamp)}
            </div>
          </WatermelonBentoCard>
        )}
      </div>
    </div>
  )
}

export default AuditTab
