import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  Trash2,
  AlertCircle,
  Loader2,
  BookOpen,
  RotateCcw,
} from 'lucide-react';
import type { ChatMessage, PaperDocument } from '../types';

interface ChatPanelProps {
  paper: PaperDocument;
  messages: ChatMessage[];
  isStreaming: boolean;
  onSendMessage: (question: string) => void;
  onClearChat: () => void;
  onJumpToPage: (pageNumber: number) => void;
  onRetryLast?: () => void;
}

const SUGGESTED_QUESTIONS = [
  'What dataset did they use?',
  'Summarize the methodology in 3 bullet points.',
  'What were the main quantitative results?',
  'What limitations do the authors report?',
];

/**
 * Converts inline citations like [Page 3] or [Pages 4-5] into safe internal markdown links
 * so clicking them jumps the left-hand PaperReader directly to that page.
 */
function linkifyPageCitations(markdownText: string, maxPage: number): string {
  // Handle single citations: [Page 4]
  let processed = markdownText.replace(
    /\[Page\s+(\d+)\]/gi,
    (_match, pageStr: string) => {
      const pageNum = Number(pageStr);
      if (pageNum >= 1 && pageNum <= maxPage) {
        return `[Page ${pageNum}](#page-${pageNum})`;
      }
      return `[Page ${pageStr}]`;
    }
  );

  // Handle ranges/lists like [Pages 4-5] or [Pages 4, 5]
  processed = processed.replace(
    /\[Pages?\s+(\d+)\s*[-–,]\s*(\d+)\]/gi,
    (_match, p1: string, p2: string) => {
      const first = Number(p1);
      if (first >= 1 && first <= maxPage) {
        return `[Pages ${p1}–${p2}](#page-${first})`;
      }
      return `[Pages ${p1}–${p2}]`;
    }
  );

  return processed;
}

export function ChatPanel({
  paper,
  messages,
  isStreaming,
  onSendMessage,
  onClearChat,
  onJumpToPage,
  onRetryLast,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  return (
    <section
      aria-label="Paper Q&A chat"
      className="flex flex-col h-full bg-white min-h-0"
    >
      {/* Chat Pane Header */}
      <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Paper Q&amp;A Chat
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Answers are strictly restricted to this PDF
          </p>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={onClearChat}
            disabled={isStreaming}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Clear chat</span>
          </button>
        )}
      </div>

      {/* Chat History Feed */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5 bg-slate-50/50">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center max-w-xl mx-auto py-6">
            <div className="flex items-center gap-2.5 text-slate-900">
              <BookOpen className="w-5 h-5 text-blue-700 shrink-0" aria-hidden="true" />
              <h3 className="font-serif text-lg font-semibold">
                Ask anything about &ldquo;{paper.title}&rdquo;
              </h3>
            </div>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Ask about datasets, formulas, experimental setups, or results. If a topic is not
              covered in the paper, the bot will reply:{' '}
              <span className="font-medium text-slate-900">
                &ldquo;This is not mentioned in the paper.&rdquo;
              </span>
            </p>

            <div className="mt-6">
              <p className="text-xs font-medium text-slate-500 mb-2.5">
                Suggested starter questions
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => onSendMessage(q)}
                    disabled={isStreaming}
                    className="text-left px-3.5 py-2.5 min-h-[44px] text-sm text-slate-800 bg-white border border-slate-200 hover:border-blue-600 hover:text-blue-800 rounded-lg transition-colors cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[85%] bg-slate-900 text-white rounded-xl px-4 py-3 text-sm leading-relaxed">
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <div className="mt-1.5 text-[11px] font-mono tabular-nums text-slate-300 text-right">
                      You · {msg.createdAt}
                    </div>
                  </div>
                </div>
              );
            }

            const linkedMarkdown = linkifyPageCitations(
              msg.content || '',
              paper.pageCount
            );

            return (
              <div key={msg.id} className="flex justify-start">
                <div className="w-full max-w-[92%] bg-white border border-slate-200 rounded-xl px-5 py-4 text-sm text-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-900">
                      Paper Assistant
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-400">
                      {msg.createdAt}
                    </span>
                  </div>

                  {msg.error ? (
                    <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                        <span>{msg.error}</span>
                      </div>
                      {onRetryLast && (
                        <button
                          type="button"
                          onClick={onRetryLast}
                          className="inline-flex items-center gap-1 text-xs font-medium text-red-900 underline underline-offset-2 shrink-0 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" aria-hidden="true" />
                          Retry
                        </button>
                      )}
                    </div>
                  ) : msg.isStreaming && !msg.content ? (
                    <div className="flex items-center gap-2 text-slate-500 py-1">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-700" aria-hidden="true" />
                      <span>Searching the paper for evidence...</span>
                    </div>
                  ) : (
                    <>
                      {msg.notInPaper && !msg.isStreaming && (
                        <div className="mb-3 inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" aria-hidden="true" />
                          <span>Not found in uploaded paper</span>
                        </div>
                      )}

                      <div className="paper-answer-prose">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({ href, children }) => {
                              if (href && href.startsWith('#page-')) {
                                const pageNum = Number(href.replace('#page-', ''));
                                return (
                                  <button
                                    type="button"
                                    onClick={() => onJumpToPage(pageNum)}
                                    title={`Jump to page ${pageNum}`}
                                    className="inline-flex items-center font-mono text-xs font-medium text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded mx-0.5 transition-colors cursor-pointer align-baseline"
                                  >
                                    {children}
                                  </button>
                                );
                              }
                              return (
                                <span className="underline text-slate-700">{children}</span>
                              );
                            },
                          }}
                        >
                          {linkedMarkdown}
                        </ReactMarkdown>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Bottom Chat Input Composer */}
      <div className="border-t border-slate-200 bg-white px-4 sm:px-6 py-3.5 shrink-0">
        <form onSubmit={handleSubmit} className="flex items-end gap-2.5">
          <div className="flex-1">
            <label htmlFor="paper-question-input" className="sr-only">
              Ask a question about the uploaded research paper
            </label>
            <textarea
              id="paper-question-input"
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              placeholder="Ask a question about this paper (e.g., What dataset did they use?)"
              className="w-full resize-none rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none disabled:opacity-60 leading-relaxed"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            aria-label="Send question"
            className="inline-flex items-center justify-center gap-2 px-4 min-w-[44px] h-[44px] rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="w-4 h-4" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">Ask</span>
          </button>
        </form>
      </div>
    </section>
  );
}
