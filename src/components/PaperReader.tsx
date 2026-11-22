import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Download,
  FileWarning,
} from 'lucide-react';
import type { PaperDocument } from '../types';

interface PaperReaderProps {
  paper: PaperDocument;
  activePage: number;
  highlightedPage: number | null;
  onSelectPage: (pageNumber: number) => void;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderHighlightedParagraph(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${escapeRegExp(query.trim())})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, idx) =>
    idx % 2 === 1 ? (
      <mark key={idx} className="bg-amber-200 text-slate-900 rounded-xs px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export function PaperReader({
  paper,
  activePage,
  highlightedPage,
  onSelectPage,
}: PaperReaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);
  const pageRefs = useRef<Record<number, HTMLElement | null>>({});

  // Compute pages matching the search query
  const matchingPages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return paper.pages
      .filter((p) => p.text.toLowerCase().includes(q))
      .map((p) => p.pageNumber);
  }, [paper.pages, searchQuery]);

  // Scroll smoothly to activePage when triggered externally (e.g., clicking [Page X] in chat)
  useEffect(() => {
    const el = pageRefs.current[activePage];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activePage]);

  const handleJumpMatch = (direction: 1 | -1) => {
    if (matchingPages.length === 0) return;
    const nextIdx =
      (activeMatchIdx + direction + matchingPages.length) % matchingPages.length;
    setActiveMatchIdx(nextIdx);
    onSelectPage(matchingPages[nextIdx]);
  };

  return (
    <section
      aria-label="Research paper viewer"
      className="flex flex-col h-full bg-slate-50 border-slate-200 lg:border-r min-h-0"
    >
      {/* Paper metadata and navigation toolbar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-5 py-3.5 shrink-0 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1
              className="font-serif text-base sm:text-lg font-semibold text-slate-900 truncate"
              title={paper.title}
            >
              {paper.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-0.5 tabular-nums">
              <span className="truncate max-w-[200px]" title={paper.fileName}>
                {paper.fileName}
              </span>
              <span aria-hidden="true">·</span>
              <span>{paper.pageCount} pages</span>
              <span aria-hidden="true">·</span>
              <span>{paper.wordCount.toLocaleString()} words</span>
              {paper.isScannedFallback && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-700 font-medium">Scanned PDF visual mode</span>
                </>
              )}
            </div>
          </div>

          <a
            href={`/api/papers/${encodeURIComponent(paper.paperId)}/pdf`}
            download={paper.fileName}
            title="Download original PDF"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>PDF</span>
          </a>
        </div>

        {/* Search & Page Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="relative flex-1 min-w-[180px] flex items-center">
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setActiveMatchIdx(0);
              }}
              placeholder="Find text in paper..."
              aria-label="Find text in paper"
              className="w-full pl-8 pr-20 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
            />
            {searchQuery && (
              <div className="absolute right-1.5 flex items-center gap-1">
                <span className="text-[11px] font-mono tabular-nums text-slate-500 px-1">
                  {matchingPages.length > 0
                    ? `${activeMatchIdx + 1}/${matchingPages.length}`
                    : '0/0'}
                </span>
                {matchingPages.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleJumpMatch(-1)}
                      aria-label="Previous search match"
                      className="p-1 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleJumpMatch(1)}
                      aria-label="Next search match"
                      className="p-1 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onSelectPage(Math.max(1, activePage - 1))}
              disabled={activePage <= 1}
              aria-label="Previous page"
              className="p-1.5 min-w-[34px] min-h-[34px] flex items-center justify-center border border-slate-200 rounded-md bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2.5 text-xs font-mono tabular-nums text-slate-700 whitespace-nowrap">
              Page {activePage} / {paper.pageCount}
            </span>
            <button
              type="button"
              onClick={() => onSelectPage(Math.min(paper.pageCount, activePage + 1))}
              disabled={activePage >= paper.pageCount}
              aria-label="Next page"
              className="p-1.5 min-w-[34px] min-h-[34px] flex items-center justify-center border border-slate-200 rounded-md bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Page Sheets */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
        {paper.isScannedFallback && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            <FileWarning className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" aria-hidden="true" />
            <p className="leading-relaxed">
              This PDF contains minimal selectable text (likely scanned images). You can still ask
              questions—the Q&amp;A engine reads the PDF visually to ground answers.
            </p>
          </div>
        )}

        {paper.pages.map((page) => {
          const isHighlighted = highlightedPage === page.pageNumber;
          const paragraphs = page.text
            ? page.text.split(/\n{2,}/).filter((p) => p.trim().length > 0)
            : [];

          return (
            <article
              key={page.pageNumber}
              ref={(el) => {
                pageRefs.current[page.pageNumber] = el;
              }}
              onClick={() => onSelectPage(page.pageNumber)}
              className={`bg-white rounded-lg border transition-colors p-5 sm:p-6 ${
                isHighlighted
                  ? 'border-blue-600 ring-2 ring-blue-100'
                  : activePage === page.pageNumber
                    ? 'border-slate-300'
                    : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-4 pb-3 mb-3.5 border-b border-slate-100">
                <span className="font-mono text-xs font-medium text-slate-500 tabular-nums">
                  Page {page.pageNumber} of {paper.pageCount}
                </span>
                {isHighlighted && (
                  <span className="text-xs font-medium text-blue-700">
                    Cited in answer
                  </span>
                )}
              </div>

              {paragraphs.length > 0 ? (
                <div className="space-y-3 text-[13.5px] leading-relaxed text-slate-700">
                  {paragraphs.map((para, idx) => (
                    <p key={idx} className="whitespace-pre-line">
                      {renderHighlightedParagraph(para, searchQuery)}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">
                  No selectable text extracted on this page.
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
