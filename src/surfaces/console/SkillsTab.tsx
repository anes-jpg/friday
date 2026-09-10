import React from "react";
import { useFridayStore } from "@/lib/store";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Sparkles, Shield, FolderGit2, CheckCircle2 } from "lucide-react";

export const SkillsTab: React.FC = () => {
  const { skills, toggleSkill } = useFridayStore();

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[var(--text-head)] font-semibold text-[var(--color-text)]">
            Installed Skills (SDK)
          </h2>
          <p className="text-[var(--text-micro)] text-[var(--color-mute)]">
            Extensible capabilities loaded from %APPDATA%/FRIDAY/skills/. Permissions gated at install.
          </p>
        </div>
        <Button variant="secondary" size="sm">
          Open Skills Folder
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {skills.map((skill) => (
          <Card key={skill.id} variant="hull" className="flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-[var(--color-plate)] text-[var(--color-acid)]">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text-body)] text-[var(--color-text)]">
                      {skill.name}
                    </h3>
                    <span className="text-[10px] font-mono text-[var(--color-mute)]">
                      v{skill.version} · {skill.id}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => toggleSkill(skill.id)}
                  className={`px-2 py-0.5 rounded text-xs font-mono ${
                    skill.enabled
                      ? "bg-[oklch(78%_0.19_152_/_0.15)] text-[var(--color-acid)]"
                      : "bg-[var(--color-plate)] text-[var(--color-mute)]"
                  }`}
                >
                  {skill.enabled ? "Enabled" : "Disabled"}
                </button>
              </div>

              <p className="mt-3 text-xs text-[var(--color-mute)] leading-relaxed">
                {skill.description}
              </p>

              <div className="mt-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-mute)]">
                  Required Permissions:
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {skill.permissions.map((p) => (
                    <span
                      key={p}
                      className="px-1.5 py-0.5 rounded bg-[var(--color-plate)] border border-[var(--color-edge)] font-mono text-[10px] text-[var(--color-text)]"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--color-edge)] flex items-center justify-between text-[11px] text-[var(--color-mute)]">
              <span className="flex items-center gap-1 font-mono">
                <Shield className="w-3.5 h-3.5 text-[var(--color-acid)]" /> Sandboxed Deno runtime
              </span>
              <button className="hover:text-[var(--color-text)] transition-colors">
                View SKILL.md
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
