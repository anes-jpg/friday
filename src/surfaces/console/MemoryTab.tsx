import React, { useState } from "react";
import { useFridayStore } from "@/lib/store";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Search, Trash2, Brain, Check, Database } from "lucide-react";

export const MemoryTab: React.FC = () => {
  const { facts, deleteFact } = useFridayStore();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredFacts = facts.filter((f) =>
    f.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[var(--text-head)] font-semibold text-[var(--color-text)]">
            Semantic Memory & Extracted Facts
          </h2>
          <p className="text-[var(--text-micro)] text-[var(--color-mute)]">
            Auditable memory store stored in SQLCipher. Facts are retrieved via bge-small vectors.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-64">
            <Input
              icon={<Search className="w-3.5 h-3.5" />}
              placeholder="Search facts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fact Content</TableHead>
            <TableHead>Confidence</TableHead>
            <TableHead>Source Context</TableHead>
            <TableHead>Recorded</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredFacts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-6 text-[var(--color-mute)]">
                No matching memory facts found.
              </TableCell>
            </TableRow>
          ) : (
            filteredFacts.map((fact) => (
              <TableRow key={fact.id}>
                <TableCell className="font-medium text-[var(--color-text)] max-w-md">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-[var(--color-acid)] shrink-0" />
                    <span>{fact.content}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  <span
                    className={
                      fact.confidence >= 0.95
                        ? "text-[var(--color-acid)]"
                        : "text-[var(--color-warn)]"
                    }
                  >
                    {(fact.confidence * 100).toFixed(0)}%
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs text-[var(--color-mute)]">
                  {fact.sourceMessageId}
                </TableCell>
                <TableCell className="font-mono text-xs text-[var(--color-mute)]">
                  {new Date(fact.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <button
                    onClick={() => deleteFact(fact.id)}
                    title="Delete fact permanently from memory"
                    className="p-1.5 rounded hover:bg-[var(--color-fail)]/20 text-[var(--color-mute)] hover:text-[var(--color-fail)] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
