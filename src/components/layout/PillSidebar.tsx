import React from "react";
import { cn } from "@/lib/utils";
import { FridayOrb } from "@/components/orb";
import {
  Bot,
  MessageSquare,
  Sparkles,
  LayoutGrid,
  ShoppingBag,
  Check,
  Copy,
  Terminal,
  Globe,
  GitPullRequest,
  Wrench,
  FolderKanban,
} from "lucide-react";

interface PillSidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  className?: string;
}

export const PillSidebar: React.FC<PillSidebarProps> = ({
  activeTab,
  onSelectTab,
  className,
}) => {
  return (
    <aside className={cn("flex items-start gap-4 z-20 select-none", className)}>
      {/* Black Pill Dock */}
      <div className="w-14 py-4 bg-black/95 border border-white/20 rounded-full flex flex-col items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl max-h-[calc(100vh-120px)] overflow-y-auto no-scrollbar gap-3">
        {/* Top App Logo Mark */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shadow-[0_0_15px_rgba(142,131,190,0.35)] shrink-0">
            <img src="/friday-logo.svg" alt="FRIDAY" className="w-full h-full object-cover" />
          </div>

          <div className="h-[1px] w-6 bg-white/20 shrink-0" />

          {/* Nav Icons: Clean User-Facing & Operator Tabs */}
          <nav className="flex flex-col items-center gap-2">
            {[
              { id: "chat", icon: <MessageSquare className="w-4 h-4" />, label: "Chat & Voice Operator" },
              { id: "projects", icon: <FolderKanban className="w-4 h-4" />, label: "Project Mode" },
              { id: "beast", icon: <Terminal className="w-4 h-4" />, label: "Beast AST & Code Search" },
              { id: "browser", icon: <Globe className="w-4 h-4" />, label: "Browser Operator" },
              { id: "review", icon: <GitPullRequest className="w-4 h-4" />, label: "OpenCodeReview Auditor" },
              { id: "delphi", icon: <Wrench className="w-4 h-4" />, label: "Delphi Media & Utils" },
              { id: "automations", icon: <Bot className="w-4 h-4" />, label: "Automations" },
              { id: "skills", icon: <Sparkles className="w-4 h-4" />, label: "Skills & Tools" },
              { id: "memory", icon: <LayoutGrid className="w-4 h-4" />, label: "Memory & Facts" },
              { id: "settings", icon: <ShoppingBag className="w-4 h-4" />, label: "Settings & Profiles" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                title={item.label}
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer shrink-0",
                  activeTab === item.id
                    ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.6)] scale-105"
                    : "text-zinc-400 hover:text-white hover:bg-white/10"
                )}
              >
                {item.icon}
              </button>
            ))}
          </nav>
        </div>

        {/* Bottom Glowing Orb */}
        <div className="relative group cursor-pointer flex items-center justify-center p-1" onClick={() => onSelectTab("chat")}>
          <FridayOrb size={26} dotSize={1.2} />
        </div>
      </div>

      {/* Floating Translucent Cards (Image 3 Companion Cards) */}
      <div className="hidden lg:flex flex-col gap-3 w-64">
        {/* Get Started Card */}
        <div className="bg-black/75 backdrop-blur-xl border border-white/15 rounded-2xl p-4 shadow-2xl">
          <div className="text-[11px] font-mono font-bold text-white mb-2 tracking-wider uppercase">
            Get Started
          </div>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="w-4 h-4 rounded-full bg-white text-black flex items-center justify-center text-[10px]">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </span>
              <span>1. Connect GLM</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="w-4 h-4 rounded-full bg-white text-black flex items-center justify-center text-[10px]">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </span>
              <span>2. Audio Endpoint</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <span className="w-4 h-4 rounded-full border border-white/30 flex items-center justify-center text-[10px] text-zinc-400">
                3
              </span>
              <span>3. Start Session</span>
            </div>
          </div>
        </div>

        {/* Model Card */}
        <div className="bg-black/75 backdrop-blur-xl border border-white/15 rounded-2xl p-4 shadow-2xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full bg-zinc-800 border border-white/20 flex items-center justify-center text-[10px] font-bold">
              K
            </div>
            <span className="text-xs font-bold text-white font-mono">GLM-4 / Kimi-K2</span>
          </div>
          <div className="text-[10px] text-zinc-400 font-mono">Sparse Attention // Local ASR</div>
          <div className="mt-2 text-xs font-mono text-zinc-300">
            <span className="text-[10px] text-zinc-500 uppercase block">Input</span>
            <span className="text-sm font-bold text-white">$1.50</span> / MTok
          </div>
        </div>

        {/* Copy & Run Code Card */}
        <div className="bg-black/75 backdrop-blur-xl border border-white/15 rounded-2xl p-3 shadow-2xl font-mono text-[10px]">
          <div className="flex items-center justify-between text-zinc-400 mb-1.5 pb-1 border-b border-white/10">
            <span className="flex items-center gap-1">
              <Terminal className="w-3 h-3 text-[var(--color-acid)]" />
              Copy &amp; Run
            </span>
            <button
              onClick={() => navigator.clipboard.writeText("curl http://localhost:1420/health")}
              className="hover:text-white transition-colors"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
          <div className="text-zinc-400 space-y-0.5">
            <div><span className="text-zinc-600 mr-2">1</span><span className="text-cyan-400">curl</span> -X GET \</div>
            <div><span className="text-zinc-600 mr-2">2</span>  http://127.0.0.1:1420 \</div>
            <div><span className="text-zinc-600 mr-2">3</span>  -H <span className="text-[hsl(var(--success))]">&quot;X-Friday-Auth&quot;</span></div>
          </div>
        </div>
      </div>
    </aside>
  );
};
