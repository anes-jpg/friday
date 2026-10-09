import React, { useState } from "react"
import { useFridayStore } from "@/lib/store"
import type { Skill } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Sparkles, FolderOpen, ChevronDown, ChevronRight, ShieldCheck } from "lucide-react"
import { invokeCommand, isDesktop } from "@/lib/ipc"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export const SkillsTab: React.FC = () => {
  const { skills, toggleSkill } = useFridayStore()
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null)

  const handleOpenFolder = async () => {
    try {
      if (isDesktop) {
        await invokeCommand("shell.run", {
          binary: "explorer",
          args: ["%APPDATA%\\FRIDAY\\skills"],
        })
        toast.success("Opened %APPDATA%/FRIDAY/skills in Explorer")
      } else {
        await navigator.clipboard.writeText("%APPDATA%\\FRIDAY\\skills")
        toast.info("Copied skills path to clipboard: %APPDATA%/FRIDAY/skills")
      }
    } catch {
      toast.error("Failed to open skills directory")
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedSkillId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[hsl(var(--surface))] text-[hsl(var(--ink))] p-6 overflow-y-auto select-none">
      {/* Standard Page Header */}
      <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4 mb-6 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-[hsl(var(--signal))]" />
            <h2 className="text-lg font-semibold tracking-tight text-[hsl(var(--ink))]">
              Installed Skills & Capabilities
            </h2>
            <span className="font-instrument text-[9px] px-1.5 py-0.5 rounded border border-[hsl(var(--signal))]/30 bg-[hsl(var(--signal))]/10 text-[hsl(var(--signal))] uppercase">
              SDK EXTENSIONS
            </span>
          </div>
          <p className="font-instrument text-[11px] text-[hsl(var(--muted))] mt-1">
            Gated system tools and domain workflows loaded from local filesystem.
          </p>
        </div>

        <Button
          size="sm"
          onClick={handleOpenFolder}
          className="font-instrument text-xs bg-[hsl(var(--surface-raised))] border border-black/10 dark:border-white/10 text-[hsl(var(--ink))] hover:border-[hsl(var(--signal))] cursor-pointer gap-1.5"
        >
          <FolderOpen className="size-3.5" />
          Open Skills Folder
        </Button>
      </div>

      {/* List Rows with Capability, Origin, and Permissions */}
      <div className="rounded-[var(--radius-panel)] border border-black/10 dark:border-white/10 bg-[hsl(var(--surface-raised))] divide-y divide-black/5 dark:divide-white/5 overflow-hidden">
        {skills.map((skill) => {
          const isExpanded = expandedSkillId === skill.id
          return (
            <div key={skill.id} className="transition-colors hover:bg-black/[0.01] dark:hover:bg-white/[0.01]">
              <div className="flex items-center justify-between p-4 gap-4">
                <button
                  type="button"
                  onClick={() => toggleExpand(skill.id)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                >
                  <span className="text-[hsl(var(--muted))]">
                    {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[hsl(var(--ink))] truncate">
                        {skill.name}
                      </span>
                      <span className="font-instrument text-[10px] text-[hsl(var(--muted))]">
                        v{skill.version} · {skill.id}
                      </span>
                    </div>
                    <p className="text-xs text-[hsl(var(--muted))] truncate mt-0.5">
                      {skill.description}
                    </p>
                  </div>
                </button>

                {/* Origin & Permissions summary */}
                <div className="hidden sm:flex items-center gap-2 font-instrument text-xs text-[hsl(var(--muted))] shrink-0">
                  <ShieldCheck className="size-3.5 text-[hsl(var(--signal))]" />
                  <span>{skill.permissions.length} permissions</span>
                </div>

                {/* Explicit Text + Switch */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className={cn(
                    "font-instrument text-xs font-semibold uppercase",
                    skill.enabled ? "text-[hsl(var(--signal))]" : "text-[hsl(var(--muted))]"
                  )}>
                    {skill.enabled ? "ENABLED" : "DISABLED"}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSkill(skill.id)}
                    aria-label={`Toggle ${skill.name}`}
                    className={cn(
                      "w-10 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer",
                      skill.enabled ? "bg-[hsl(var(--signal))]" : "bg-black/20 dark:bg-white/20"
                    )}
                  >
                    <div
                      className={cn(
                        "size-4 rounded-full bg-white transition-transform",
                        skill.enabled ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </div>

              {/* Inline Permission Expansion */}
              {isExpanded && (
                <div className="px-10 pb-4 pt-1 font-instrument text-xs border-t border-black/5 dark:border-white/5 bg-[hsl(var(--surface))]/50 space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted))] font-semibold">
                    Granted Capability Permissions:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {skill.permissions.map((perm, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[hsl(var(--ink))] text-[10px] border border-black/10 dark:border-white/10"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default SkillsTab
