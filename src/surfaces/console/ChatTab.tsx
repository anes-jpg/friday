import React, { useState } from "react";
import { useFridayStore } from "@/lib/store";
import { ToolCall } from "@/lib/bindings";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Send, ChevronDown, ChevronRight, Terminal, Clock, Hash, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";

export const ChatTab: React.FC = () => {
  const { activeThreadId, messages, submitQuery, telemetry } = useFridayStore();
  const [inputText, setInputText] = useState("");
  const threadMessages = messages[activeThreadId] || [];

  const handleSend = () => {
    if (!inputText.trim()) return;
    submitQuery(inputText);
    setInputText("");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {threadMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <div className="flex items-center gap-2 mb-1 text-[var(--text-micro)] text-[var(--color-mute)] font-mono">
              <span className="font-semibold uppercase text-[var(--color-text)]">
                {msg.role === "user" ? "You" : "FRIDAY"}
              </span>
              <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
              {msg.latency_ms && (
                <span className="text-[var(--color-acid)]">
                  {msg.latency_ms}ms ({msg.tokens} tokens)
                </span>
              )}
            </div>

            <div
              className={`max-w-2xl rounded-[var(--radius-control)] p-3.5 text-[var(--text-body)] border ${
                msg.role === "user"
                  ? "bg-[var(--color-plate)] border-[var(--color-edge)] text-[var(--color-text)]"
                  : "bg-[var(--color-hull)] border-[var(--color-edge)] text-[var(--color-text)]"
              }`}
            >
              {msg.say && (
                <p className="font-sans leading-relaxed mb-2 text-[var(--color-text)]">
                  {msg.say}
                </p>
              )}

              {msg.show && (
                <div className="prose prose-invert max-w-none text-xs leading-5 p-2 rounded bg-[var(--color-void)] border border-[var(--color-edge)] text-[var(--color-text)] font-sans">
                  <ReactMarkdown>{msg.show}</ReactMarkdown>
                </div>
              )}

              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-3 space-y-2">
                  <span className="text-[10px] font-mono text-[var(--color-mute)] uppercase tracking-wider">
                    Executed Tools
                  </span>
                  {msg.toolCalls.map((tc) => (
                    <ToolCallCard key={tc.id} toolCall={tc} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input bar inside console */}
      <div className="p-3 border-t border-[var(--color-edge)] bg-[var(--color-plate)] flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Speak or type a command to FRIDAY..."
          className="flex-1 h-9 px-3 rounded-[var(--radius-control)] bg-[var(--color-void)] border border-[var(--color-edge)] text-[var(--text-body)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-acid)]"
        />
        <Button variant="primary" size="md" onClick={handleSend}>
          <Send className="w-3.5 h-3.5 mr-1" />
          Send
        </Button>
      </div>
    </div>
  );
};

const ToolCallCard: React.FC<{ toolCall: ToolCall }> = ({ toolCall }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-[var(--radius-control)] border border-[var(--color-edge)] bg-[var(--color-void)] text-xs overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-2 hover:bg-[var(--color-plate)] transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-[var(--color-acid)]" />
          <span className="font-mono font-medium text-[var(--color-text)]">
            {toolCall.name}
          </span>
          <span className="text-[10px] text-[var(--color-mute)] font-mono">
            ({toolCall.duration_ms}ms)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--color-acid)] font-mono">
            {toolCall.status}
          </span>
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-[var(--color-mute)]" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[var(--color-mute)]" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="p-2 border-t border-[var(--color-edge)] bg-[oklch(12%_0.005_265_/_0.7)] font-mono text-[11px] space-y-2">
          <div>
            <span className="text-[var(--color-mute)]">Arguments:</span>
            <pre className="mt-1 p-1.5 rounded bg-[var(--color-plate)] overflow-x-auto text-[var(--color-text)]">
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>
          {toolCall.output && (
            <div>
              <span className="text-[var(--color-mute)]">Output:</span>
              <pre className="mt-1 p-1.5 rounded bg-[var(--color-plate)] overflow-x-auto text-[var(--color-acid)]">
                {toolCall.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
