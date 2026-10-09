import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  FileCode,
  Regex,
  KeyRound,
  FileDiff,
  Copy,
  Check,
  Zap,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

type DelphiSubtool = "json" | "regex" | "crypto" | "diff";

export const DelphiTab: React.FC = () => {
  const [activeTool, setActiveTool] = useState<DelphiSubtool>("json");
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  // --- 1. JSON STUDIO STATE ---
  const [jsonInput, setJsonInput] = useState<string>(
    JSON.stringify(
      {
        operator: "FRIDAY",
        version: "1.0.0",
        engine: "Beast+Delphi",
        active_turn: {
          intent: "execute_workflow",
          confidence: 0.985,
          latency_ms: 142,
        },
        telemetry: {
          cpu_idle: true,
          audio_rms: 0.04,
          memory_mb: 28.4,
        },
      },
      null,
      2
    )
  );
  const [jsonIndent, setJsonIndent] = useState<number>(2);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const formattedJson = useMemo(() => {
    try {
      setJsonError(null);
      const parsed = JSON.parse(jsonInput);
      return JSON.stringify(parsed, null, jsonIndent);
    } catch (e) {
      setJsonError((e as Error).message);
      return jsonInput;
    }
  }, [jsonInput, jsonIndent]);

  // --- 2. REGEX TESTER STATE ---
  const [regexPattern, setRegexPattern] = useState<string>("([A-Z]+)_([0-9]+)");
  const [regexFlags, setRegexFlags] = useState<string>("g");
  const [regexInput, setRegexInput] = useState<string>(
    "TASK_101 completed.\nERROR_404 not found.\nSIGNAL_999 verified in 12ms."
  );

  const regexMatches = useMemo(() => {
    try {
      const reg = new RegExp(regexPattern, regexFlags);
      const matches: { match: string; index: number; groups: string[] }[] = [];
      let m: RegExpExecArray | null;

      if (!regexFlags.includes("g")) {
        m = reg.exec(regexInput);
        if (m) {
          matches.push({ match: m[0], index: m.index, groups: m.slice(1) });
        }
      } else {
        while ((m = reg.exec(regexInput)) !== null) {
          matches.push({ match: m[0], index: m.index, groups: m.slice(1) });
          if (m.index === reg.lastIndex) reg.lastIndex++;
        }
      }
      return { matches, error: null };
    } catch (e) {
      return { matches: [], error: (e as Error).message };
    }
  }, [regexPattern, regexFlags, regexInput]);

  // --- 3. CRYPTO & TOKEN DECODER STATE ---
  const [jwtInput, setJwtInput] = useState<string>(
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJvcGVyYXRvci1hbmVzIiwiaXNzIjoiZnJpZGF5LW9zIiwiZXhwIjoxNzg5OTE5MDAwLCJyb2xlcyI6WyJhZG1pbiIsInZvaWNlIl19.signature"
  );
  const [uuidBatch, setUuidBatch] = useState<string[]>(() =>
    Array.from({ length: 4 }, () => crypto.randomUUID())
  );

  const decodedJwt = useMemo(() => {
    try {
      const parts = jwtInput.trim().split(".");
      if (parts.length < 2) return null;
      const header = JSON.parse(atob(parts[0]));
      const payload = JSON.parse(atob(parts[1]));
      return { header, payload, valid: true };
    } catch {
      return null;
    }
  }, [jwtInput]);

  // --- 4. TEXT DIFF STATE ---
  const [diffOriginal, setDiffOriginal] = useState<string>(
    "const state = 'idle';\nfunction tick() {\n  return state;\n}"
  );
  const [diffModified, setDiffModified] = useState<string>(
    "const state = 'active';\nfunction tick() {\n  console.log('Kinetic tick');\n  return state;\n}"
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[hsl(var(--surface))] text-[hsl(var(--ink))] p-6 overflow-y-auto">
      {/* Standard Tab Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[hsl(var(--line))] pb-5 mb-6 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-instrument text-xs uppercase tracking-wider text-[hsl(var(--muted))]">
              Utilities // Workbench
            </span>
            <span className="rounded bg-black/[.05] dark:bg-white/[.08] px-1.5 py-0.5 font-instrument text-[10px] text-[hsl(var(--muted))]">
              DELPHI
            </span>
          </div>
          <h1 className="text-xl font-medium tracking-tight text-[hsl(var(--ink))] mt-1">
            Delphi Developer Studio
          </h1>
          <p className="text-xs text-[hsl(var(--muted))] mt-1 font-instrument">
            High-speed local utilities: JSON inspection, Regex evaluation, JWT decoders, and text diffs.
          </p>
        </div>

        {/* Compact Utility Selector */}
        <div className="flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[hsl(var(--line))] bg-[hsl(var(--surface-raised))] p-1">
          <Button
            variant={activeTool === "json" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTool("json")}
            className={`text-xs h-8 px-3 gap-1.5 font-instrument ${
              activeTool === "json" ? "bg-[hsl(var(--ink))] text-[hsl(var(--surface))]" : "text-[hsl(var(--muted))]"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" /> JSON
          </Button>
          <Button
            variant={activeTool === "regex" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTool("regex")}
            className={`text-xs h-8 px-3 gap-1.5 font-instrument ${
              activeTool === "regex" ? "bg-[hsl(var(--ink))] text-[hsl(var(--surface))]" : "text-[hsl(var(--muted))]"
            }`}
          >
            <Regex className="w-3.5 h-3.5" /> Regex
          </Button>
          <Button
            variant={activeTool === "crypto" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTool("crypto")}
            className={`text-xs h-8 px-3 gap-1.5 font-instrument ${
              activeTool === "crypto" ? "bg-[hsl(var(--ink))] text-[hsl(var(--surface))]" : "text-[hsl(var(--muted))]"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" /> JWT & UUID
          </Button>
          <Button
            variant={activeTool === "diff" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTool("diff")}
            className={`text-xs h-8 px-3 gap-1.5 font-instrument ${
              activeTool === "diff" ? "bg-[hsl(var(--ink))] text-[hsl(var(--surface))]" : "text-[hsl(var(--muted))]"
            }`}
          >
            <FileDiff className="w-3.5 h-3.5" /> Diff
          </Button>
        </div>
      </div>

      {/* SUBTOOL 1: JSON STUDIO (40/60 Split) */}
      {activeTool === "json" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0">
          <div className="lg:col-span-5 flex flex-col rounded-[var(--radius-panel)] border border-[hsl(var(--line))] bg-[hsl(var(--surface-raised))] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-instrument text-xs text-[hsl(var(--muted))] uppercase tracking-wider">
                JSON Input
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] px-2 font-instrument"
                  onClick={() => setJsonIndent(jsonIndent === 2 ? 4 : 2)}
                >
                  Indent: {jsonIndent}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] px-2 font-instrument"
                  onClick={() => {
                    try {
                      setJsonInput(JSON.stringify(JSON.parse(jsonInput)));
                    } catch {}
                  }}
                >
                  Minify
                </Button>
              </div>
            </div>
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              className="flex-1 w-full bg-black/5 dark:bg-white/5 border border-[hsl(var(--line))] rounded-[var(--radius-control)] p-3 font-mono text-xs text-[hsl(var(--ink))] resize-none focus:outline-none focus:ring-1 focus:ring-[hsl(var(--signal))]"
              placeholder="Paste raw JSON here..."
              rows={16}
            />
            {jsonError && (
              <div className="flex items-center gap-1.5 text-[11px] font-instrument text-[hsl(var(--danger))] mt-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{jsonError}</span>
              </div>
            )}
          </div>

          <div className="lg:col-span-7 flex flex-col rounded-[var(--radius-panel)] border border-[hsl(var(--line))] bg-[hsl(var(--surface-raised))] p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-instrument text-xs text-[hsl(var(--muted))] uppercase tracking-wider">
                  Formatted Output
                </span>
                <span
                  className={`text-[9px] font-instrument px-1.5 py-0.5 rounded ${
                    jsonError ? "bg-red-500/10 text-[hsl(var(--danger))]" : "bg-emerald-500/10 text-[hsl(var(--success))]"
                  }`}
                >
                  {jsonError ? "SYNTAX ERROR" : "VALID JSON"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(formattedJson, "json-out")}
                className="h-7 text-xs text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] gap-1 font-instrument"
              >
                {copied === "json-out" ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[hsl(var(--success))]" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </>
                )}
              </Button>
            </div>
            <pre className="flex-1 overflow-auto bg-black text-white p-3.5 rounded-[var(--radius-control)] font-mono text-xs whitespace-pre leading-relaxed select-text">
              {formattedJson}
            </pre>
          </div>
        </div>
      )}

      {/* SUBTOOL 2: REGEX TESTER (40/60 Split) */}
      {activeTool === "regex" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0">
          <div className="lg:col-span-5 flex flex-col gap-3 rounded-[var(--radius-panel)] border border-[hsl(var(--line))] bg-[hsl(var(--surface-raised))] p-4">
            <span className="font-instrument text-xs text-[hsl(var(--muted))] uppercase tracking-wider">
              Pattern & Input
            </span>
            <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 border border-[hsl(var(--line))] rounded-[var(--radius-control)] px-3 py-1.5 font-mono text-xs">
              <span className="text-[hsl(var(--muted))]">/</span>
              <input
                type="text"
                value={regexPattern}
                onChange={(e) => setRegexPattern(e.target.value)}
                placeholder="Regex pattern..."
                className="flex-1 bg-transparent border-none text-[hsl(var(--ink))] focus:outline-none"
              />
              <span className="text-[hsl(var(--muted))]">/</span>
              <input
                type="text"
                value={regexFlags}
                onChange={(e) => setRegexFlags(e.target.value)}
                className="w-12 bg-transparent border-none text-[hsl(var(--signal))] focus:outline-none font-semibold"
                placeholder="gims"
              />
            </div>

            {regexMatches.error && (
              <div className="flex items-center gap-1.5 text-[11px] font-instrument text-[hsl(var(--danger))] p-2 rounded bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{regexMatches.error}</span>
              </div>
            )}

            <div className="flex-1 flex flex-col">
              <span className="font-instrument text-[11px] text-[hsl(var(--muted))] block mb-1">
                Test Payload
              </span>
              <textarea
                value={regexInput}
                onChange={(e) => setRegexInput(e.target.value)}
                rows={10}
                className="w-full flex-1 bg-black/5 dark:bg-white/5 border border-[hsl(var(--line))] rounded-[var(--radius-control)] p-3 font-mono text-xs text-[hsl(var(--ink))] resize-none focus:outline-none focus:ring-1 focus:ring-[hsl(var(--signal))]"
              />
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col rounded-[var(--radius-panel)] border border-[hsl(var(--line))] bg-[hsl(var(--surface-raised))] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-instrument text-xs text-[hsl(var(--muted))] uppercase tracking-wider">
                  Captured Matches
                </span>
                <span className="text-[10px] font-instrument px-2 py-0.5 rounded bg-black/[.05] dark:bg-white/[.08] text-[hsl(var(--ink))]">
                  {regexMatches.matches.length} matches
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-black text-white rounded-[var(--radius-control)] p-3 font-mono text-xs flex flex-col gap-2">
              {regexMatches.matches.length === 0 ? (
                <div className="text-white/40 italic p-4 text-center">No matches found.</div>
              ) : (
                regexMatches.matches.map((m, i) => (
                  <div key={i} className="p-2.5 rounded bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between text-white font-medium">
                      <span className="text-[hsl(var(--signal))]">Match {i + 1}: "{m.match}"</span>
                      <span className="text-[10px] text-white/50">Index {m.index}</span>
                    </div>
                    {m.groups.length > 0 && (
                      <div className="mt-1.5 pl-2 border-l border-white/20 flex flex-col gap-1 text-[11px] text-white/70">
                        {m.groups.map((g, gi) => (
                          <span key={gi}>${gi + 1}: {g}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBTOOL 3: JWT & UUID GENERATOR (40/60 Split) */}
      {activeTool === "crypto" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0">
          <div className="lg:col-span-5 flex flex-col gap-3 rounded-[var(--radius-panel)] border border-[hsl(var(--line))] bg-[hsl(var(--surface-raised))] p-4">
            <span className="font-instrument text-xs text-[hsl(var(--muted))] uppercase tracking-wider">
              JWT Decoder
            </span>
            <textarea
              value={jwtInput}
              onChange={(e) => setJwtInput(e.target.value)}
              rows={4}
              className="w-full bg-black/5 dark:bg-white/5 border border-[hsl(var(--line))] rounded-[var(--radius-control)] p-2.5 font-mono text-xs text-[hsl(var(--ink))] resize-none focus:outline-none focus:ring-1 focus:ring-[hsl(var(--signal))]"
              placeholder="Paste Bearer JWT token..."
            />
            {decodedJwt ? (
              <div className="flex flex-col gap-3 text-xs font-mono">
                <div>
                  <span className="text-[hsl(var(--muted))] text-[10px] font-instrument block mb-1">
                    HEADER
                  </span>
                  <pre className="p-2.5 rounded-[var(--radius-control)] bg-black text-white border border-[hsl(var(--line))] overflow-auto text-xs">
                    {JSON.stringify(decodedJwt.header, null, 2)}
                  </pre>
                </div>
                <div>
                  <span className="text-[hsl(var(--muted))] text-[10px] font-instrument block mb-1">
                    PAYLOAD
                  </span>
                  <pre className="p-2.5 rounded-[var(--radius-control)] bg-black text-white border border-[hsl(var(--line))] overflow-auto text-xs">
                    {JSON.stringify(decodedJwt.payload, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="text-xs font-instrument text-[hsl(var(--muted))] italic">
                Invalid or empty JWT token.
              </p>
            )}
          </div>

          <div className="lg:col-span-7 flex flex-col gap-3 rounded-[var(--radius-panel)] border border-[hsl(var(--line))] bg-[hsl(var(--surface-raised))] p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-instrument text-xs text-[hsl(var(--muted))] uppercase tracking-wider block">
                  UUID V4 Generator
                </span>
                <span className="text-xs text-[hsl(var(--muted))] font-instrument">
                  Cryptographically secure random tokens
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUuidBatch(Array.from({ length: 4 }, () => crypto.randomUUID()))}
                className="h-8 text-xs gap-1 font-instrument"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Regenerate
              </Button>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              {uuidBatch.map((id) => (
                <div
                  key={id}
                  className="flex items-center justify-between p-3 rounded-[var(--radius-control)] bg-black/5 dark:bg-white/5 border border-[hsl(var(--line))] font-mono text-xs"
                >
                  <span className="text-[hsl(var(--ink))]">{id}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] gap-1 font-instrument"
                    onClick={() => copyToClipboard(id, id)}
                  >
                    {copied === id ? (
                      <>
                        <Check className="w-3 h-3 text-[hsl(var(--success))]" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBTOOL 4: TEXT DIFF (50/50 Split) */}
      {activeTool === "diff" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1 min-h-0">
          <div className="flex flex-col rounded-[var(--radius-panel)] border border-[hsl(var(--line))] bg-[hsl(var(--surface-raised))] p-4">
            <span className="font-instrument text-xs text-[hsl(var(--muted))] uppercase tracking-wider mb-2">
              Original Buffer
            </span>
            <textarea
              value={diffOriginal}
              onChange={(e) => setDiffOriginal(e.target.value)}
              rows={14}
              className="w-full flex-1 bg-black/5 dark:bg-white/5 border border-[hsl(var(--line))] rounded-[var(--radius-control)] p-3 font-mono text-xs text-[hsl(var(--ink))] resize-none focus:outline-none focus:ring-1 focus:ring-[hsl(var(--signal))]"
            />
          </div>

          <div className="flex flex-col rounded-[var(--radius-panel)] border border-[hsl(var(--line))] bg-[hsl(var(--surface-raised))] p-4">
            <span className="font-instrument text-xs text-[hsl(var(--muted))] uppercase tracking-wider mb-2">
              Modified Buffer
            </span>
            <textarea
              value={diffModified}
              onChange={(e) => setDiffModified(e.target.value)}
              rows={14}
              className="w-full flex-1 bg-black/5 dark:bg-white/5 border border-[hsl(var(--line))] rounded-[var(--radius-control)] p-3 font-mono text-xs text-[hsl(var(--ink))] resize-none focus:outline-none focus:ring-1 focus:ring-[hsl(var(--signal))]"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DelphiTab;
