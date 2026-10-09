/** The `show` channel, rendered.
 *
 * §"Two-channel output": `say` is spoken and is plain prose; `show` is the
 * markdown, the table, the diff, the code and the URLs. She never speaks a
 * path or a bullet list — which means this component is where every path and
 * bullet list in the product ends up, and it has to read well.
 */

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("text-body text-text/90", className)}>
      <ReactMarkdown
        // Tables and strikethrough are GFM, not CommonMark. Without this plugin
        // every `show` table renders as literal pipes — see docs/adr/0001.
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-medium text-text">{children}</strong>
          ),
          em: ({ children }) => <em className="italic text-text/80">{children}</em>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-acid underline decoration-acid/30 underline-offset-2 hover:decoration-acid"
            >
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul className="mb-2 ml-4 list-disc space-y-0.5 last:mb-0 marker:text-mute">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 ml-4 list-decimal space-y-0.5 last:mb-0 marker:text-mute">
              {children}
            </ol>
          ),
          code: ({ children, className: cls }) => {
            const block = cls?.startsWith("language-")
            if (block) {
              return (
                <code className="block overflow-x-auto rounded-control bg-void px-3 py-2 font-mono text-micro leading-relaxed text-text/85">
                  {children}
                </code>
              )
            }
            return (
              <code className="rounded-[4px] bg-plate px-1 py-px font-mono text-[0.95em] text-text">
                {children}
              </code>
            )
          },
          pre: ({ children }) => <pre className="mb-2 last:mb-0">{children}</pre>,
          blockquote: ({ children }) => (
            <blockquote className="mb-2 border-l-2 border-edge pl-3 text-text/75 last:mb-0">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="mb-2 overflow-x-auto rounded-control border border-edge last:mb-0">
              <table className="w-full border-collapse text-body">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-plate/60">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b border-edge px-3 py-1.5 text-left text-micro font-normal text-mute">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-edge/50 px-3 py-1.5 tabular-nums last:border-0">
              {children}
            </td>
          ),
          hr: () => <hr className="my-3 border-edge" />,
          h1: ({ children }) => <h3 className="mb-1.5 text-head text-text">{children}</h3>,
          h2: ({ children }) => <h4 className="mb-1.5 text-head text-text">{children}</h4>,
          h3: ({ children }) => (
            <h5 className="mb-1 text-body font-medium text-text">{children}</h5>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}

