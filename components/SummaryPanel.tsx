"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface SummarySection {
  title: string;
  content: string;
}

function parseSummary(summary: string): SummarySection[] {
  const parts = summary.split(/\n?###\s+/);
  const sections: SummarySection[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    if (i === 0 && !summary.startsWith("###")) {
      sections.push({ title: "Overview", content: part });
    } else {
      const firstNewlineIdx = part.indexOf("\n");
      if (firstNewlineIdx === -1) {
        sections.push({ title: part, content: "" });
      } else {
        const title = part.slice(0, firstNewlineIdx).trim();
        const content = part.slice(firstNewlineIdx).trim();
        sections.push({ title, content });
      }
    }
  }

  return sections;
}

export default function SummaryPanel({
  summary,
  streaming,
}: {
  summary: string;
  streaming: boolean;
}) {
  const [summaryOpen, setSummaryOpen] = useState(true);
  const sections = useMemo(() => parseSummary(summary), [summary]);
  const [expandedSection, setExpandedSection] = useState<number | null>(null);

  if (!summary && !streaming) return null;

  return (
    <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
      <button
        onClick={() => setSummaryOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-zinc-800/30 transition-colors rounded-t-lg"
      >
        <span
          className={`text-zinc-500 text-xs transition-transform ${summaryOpen ? "rotate-90" : ""}`}
        >
          ▶
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Repository Summary
        </span>
        {!summaryOpen && (
          <span className="ml-auto text-[10px] text-zinc-600">
            Click to expand
          </span>
        )}
      </button>
      {summaryOpen && (
        <div className="px-4 pb-4">
          {sections.length > 1 ? (
            <div className="space-y-2">
              {sections.map((section, idx) => {
                const isExpanded = expandedSection === idx;
                return (
                  <div
                    key={idx}
                    className="rounded border border-zinc-800 bg-zinc-900/30"
                  >
                    <button
                      onClick={() =>
                        setExpandedSection(isExpanded ? null : idx)
                      }
                      className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-zinc-800/30 transition-colors"
                    >
                      <span
                        className={`text-zinc-500 text-xs transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      >
                        ▶
                      </span>
                      <span className="text-sm font-medium text-zinc-300">
                        {section.title}
                      </span>
                    </button>
                    {isExpanded && section.content && (
                      <div className="px-3 pb-3 prose-glitch text-sm text-zinc-300 leading-relaxed overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {section.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="prose-glitch text-sm text-zinc-300 leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {summary}
              </ReactMarkdown>
            </div>
          )}
          {streaming && <span className="cursor-blink" />}
        </div>
      )}
    </div>
  );
}
