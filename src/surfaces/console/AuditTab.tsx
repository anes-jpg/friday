import React, { useState } from "react"
import { useFridayStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { ScrollText, Download, Filter, Shield, AlertTriangle, ShieldAlert, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

export const AuditTab: React.FC = () => {
  const { audit } = useFridayStore()
  const [filterTier, setFilterTier] = useState<string>("all")
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null)

  const filteredLogs = audit.filter((log) => {
    if (filterTier === "all") return true
    return log.tier === filterTier
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
    <div className="flex-1 flex flex-col h-full bg-[hsl(var(--surface))] text-[hsl(var(--ink))] p-6 overflow-hidden select-none">
      {/* Standard Page Header */}
      <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4 mb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <ScrollText className="size-4 text-[hsl(var(--signal))]" />
            <h2 className="text-lg font-semibold tracking-tight text-[hsl(var(--ink))]">
              Security Audit Log
            </h2>
            <span className="font-instrument text-[9px] px-1.5 py-0.5 rounded border border-[hsl(var(--signal))]/30 bg-[hsl(var(--signal))]/10 text-[hsl(var(--signal))] uppercase">
              SQLCIPHER · APPEND-ONLY
            </span>
          </div>
          <p className="font-instrument text-[11px] text-[hsl(var(--muted))] mt-1">
            Cryptographic ledger of tool invocations, confirmations, and security decisions.
          </p>
        </div>

        <Button
          size="sm"
          onClick={handleExport}
          className="font-instrument text-xs bg-[hsl(var(--surface-raised))] border border-black/10 dark:border-white/10 text-[hsl(var(--ink))] hover:border-[hsl(var(--signal))] cursor-pointer gap-1.5"
        >
          <Download className="size-3.5" />
          Export JSON
        </Button>
      </div>

      {/* Sticky Filter Bar */}
      <div className="flex items-center gap-2 mb-4 shrink-0 font-instrument text-xs">
        <Filter className="size-3.5 text-[hsl(var(--muted))]" />
        <span className="text-[hsl(var(--muted))]">Filter:</span>
        {(["all", "green", "amber", "red"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilterTier(t)}
            className={cn(
              "px-2.5 py-1 rounded-[var(--radius-control)] border transition-all cursor-pointer uppercase text-[10px]",
              filterTier === t
                ? "bg-[hsl(var(--ink))] text-[hsl(var(--surface))] border-[hsl(var(--ink))]"
                : "bg-[hsl(var(--surface-raised))] border-black/10 dark:border-white/10 text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))]"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Main Table / Detail Split */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Table / Timeline Hybrid */}
        <div className="flex-1 rounded-[var(--radius-panel)] border border-black/10 dark:border-white/10 bg-[hsl(var(--surface-raised))] overflow-hidden flex flex-col min-h-0">
          <div className="grid grid-cols-12 px-4 py-2.5 border-b border-black/10 dark:border-white/10 font-instrument text-[10px] uppercase tracking-[.11em] text-[hsl(var(--muted))] shrink-0">
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
              filteredLogs.map((log) => {
                const isSelected = selectedAuditId === log.id
                return (
                  <div
                    key={log.id}
                    onClick={() => setSelectedAuditId(log.id)}
                    className={cn(
                      "grid grid-cols-12 items-center px-4 py-3 cursor-pointer transition-colors",
                      isSelected
                        ? "bg-[hsl(var(--signal))]/5"
                        : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                    )}
                  >
                    <span className="col-span-2 text-[hsl(var(--muted))]">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                    <span className="col-span-3 font-semibold text-[hsl(var(--ink))] truncate pr-2">
                      {log.toolName}
                    </span>
                    <span className="col-span-2 flex items-center gap-1.5">
                      {log.tier === "green" ? (
                        <Shield className="size-3 text-[hsl(var(--success))]" />
                      ) : log.tier === "amber" ? (
                        <AlertTriangle className="size-3 text-[hsl(var(--warning))]" />
                      ) : (
                        <ShieldAlert className="size-3 text-[hsl(var(--danger))]" />
                      )}
                      <span className="capitalize">{log.tier}</span>
                    </span>
                    <span className="col-span-3 text-[hsl(var(--muted))] truncate font-mono text-[11px]">
                      {log.argsHash}
                    </span>
                    <span className="col-span-2 text-right">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase",
                        log.decision === "escalated"
                          ? "bg-[hsl(var(--signal))]/10 text-[hsl(var(--signal))]"
                          : (log.decision as string) === "confirmed"
                          ? "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]"
                          : "bg-black/5 dark:bg-white/10 text-[hsl(var(--muted))]"
                      )}>
                        {log.decision}
                      </span>
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Selected Receipt Detail Inspector */}
        {selectedLog && (
          <div className="w-[320px] shrink-0 rounded-[var(--radius-panel)] border border-black/10 dark:border-white/10 bg-[hsl(var(--surface-raised))] p-4 font-instrument text-xs flex flex-col min-h-0 overflow-y-auto space-y-3">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--signal))]">
                Receipt #{selectedLog.id.slice(0, 8)}
              </span>
              <span className="text-[hsl(var(--muted))]">{selectedLog.durationMs}ms</span>
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
                  selectedLog.tier === "green" ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" :
                  selectedLog.tier === "amber" ? "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]" :
                  "bg-[hsl(var(--danger))]/10 text-[hsl(var(--danger))]"
                )}>
                  {selectedLog.tier} tier
                </span>
                <span className="text-[hsl(var(--muted))]">{selectedLog.decision}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-[hsl(var(--muted))] block">PAYLOAD HASH</span>
              <pre className="mt-1 p-2 rounded bg-[hsl(var(--surface))] border border-black/10 dark:border-white/10 text-[10px] text-[hsl(var(--ink))] overflow-x-auto">
                {selectedLog.argsHash}
              </pre>
            </div>

            <div className="pt-2 border-t border-black/10 dark:border-white/10 text-[10px] text-[hsl(var(--muted))]">
              Auditable timestamp: {new Date(selectedLog.timestamp).toISOString()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AuditTab
