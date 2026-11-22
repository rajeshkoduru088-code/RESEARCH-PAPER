import { useCallback, useState } from 'react';
import { Header } from './components/Header';
import { UploadDropzone } from './components/UploadDropzone';
import { PaperReader } from './components/PaperReader';
import { ChatPanel } from './components/ChatPanel';
import { GroundingModal } from './components/GroundingModal';
import type { ChatMessage, PaperDocument } from './types';

function formatTime(): string {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function App() {
  const [paper, setPaper] = useState<PaperDocument | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [highlightedPage, setHighlightedPage] = useState<number | null>(null);
  const [mobileTab, setMobileTab] = useState<'chat' | 'paper'>('chat');
  const [groundingModalOpen, setGroundingModalOpen] = useState(false);

  const handleUploadFile = useCallback(async (file: File) => {
    setUploadError(null);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/papers/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse PDF.');
      }

      setPaper(data as PaperDocument);
      setMessages([]);
      setActivePage(1);
      setHighlightedPage(null);
      setMobileTab('chat');
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Unable to upload this PDF file.'
      );
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleLoadSample = useCallback(async () => {
    setUploadError(null);
    setIsUploading(true);
    try {
      const response = await fetch('/api/papers/sample', {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load sample paper.');
      }

      setPaper(data as PaperDocument);
      setMessages([]);
      setActivePage(1);
      setHighlightedPage(null);
      setMobileTab('chat');
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Unable to load sample paper.'
      );
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleJumpToPage = useCallback((pageNumber: number) => {
    setActivePage(pageNumber);
    setHighlightedPage(pageNumber);
    setMobileTab('paper');
  }, []);

  const sendQuestion = useCallback(
    async (questionText: string, existingHistory: ChatMessage[]) => {
      if (!paper || isStreaming) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: questionText,
        createdAt: formatTime(),
      };

      const assistantId = crypto.randomUUID();
      const assistantPlaceholder: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: formatTime(),
        isStreaming: true,
      };

      setMessages([...existingHistory, userMsg, assistantPlaceholder]);
      setIsStreaming(true);

      try {
        const apiHistory = existingHistory
          .filter((m) => !m.error && m.content.trim().length > 0)
          .map((m) => ({
            role: m.role,
            content: m.content,
          }));

        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paperId: paper.paperId,
            question: questionText,
            history: apiHistory,
            fallbackPaper: {
              title: paper.title,
              fileName: paper.fileName,
              pages: paper.pages,
            },
          }),
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || 'Failed to get an answer.');
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Streaming response body unavailable.');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedText = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const rawEvent of events) {
            const line = rawEvent
              .split('\n')
              .find((l) => l.startsWith('data: '));
            if (!line) continue;

            const payload = JSON.parse(line.slice(6)) as {
              type: 'chunk' | 'done' | 'error';
              text?: string;
              fullText?: string;
              notInPaper?: boolean;
              message?: string;
            };

            if (payload.type === 'chunk' && payload.text) {
              accumulatedText += payload.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: accumulatedText, isStreaming: true }
                    : m
                )
              );
            } else if (payload.type === 'done') {
              const finalText = payload.fullText || accumulatedText;
              const isNotInPaper =
                typeof payload.notInPaper === 'boolean'
                  ? payload.notInPaper
                  : finalText.toLowerCase().includes('this is not mentioned in the paper');

              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: finalText,
                        notInPaper: isNotInPaper,
                        isStreaming: false,
                      }
                    : m
                )
              );
            } else if (payload.type === 'error') {
              throw new Error(payload.message || 'Model error while answering.');
            }
          }
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to generate an answer.';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, isStreaming: false, error: message }
              : m
          )
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [paper, isStreaming]
  );

  const handleSendMessage = useCallback(
    (question: string) => {
      sendQuestion(question, messages);
    },
    [messages, sendQuestion]
  );

  const handleRetryLast = useCallback(() => {
    if (isStreaming) return;
    const lastUserIndex = [...messages]
      .reverse()
      .findIndex((m) => m.role === 'user');
    if (lastUserIndex === -1) return;
    const actualIdx = messages.length - 1 - lastUserIndex;
    const lastQuestion = messages[actualIdx].content;
    const historyBefore = messages.slice(0, actualIdx);
    sendQuestion(lastQuestion, historyBefore);
  }, [messages, isStreaming, sendQuestion]);

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
      <Header
        hasPaper={Boolean(paper)}
        isUploading={isUploading}
        onUploadFile={handleUploadFile}
        onLoadSample={handleLoadSample}
        onResetToUpload={() => {
          setPaper(null);
          setMessages([]);
          setUploadError(null);
          setHighlightedPage(null);
        }}
        onOpenGroundingInfo={() => setGroundingModalOpen(true)}
      />

      {!paper ? (
        <UploadDropzone
          isUploading={isUploading}
          uploadError={uploadError}
          onUploadFile={handleUploadFile}
          onLoadSample={handleLoadSample}
        />
      ) : (
        <main className="flex-1 flex flex-col min-h-0">
          {/* Mobile segmented tab switch (< lg) */}
          <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-2 shrink-0">
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setMobileTab('chat')}
                className={`py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  mobileTab === 'chat'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Q&amp;A Chat ({messages.length})
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('paper')}
                className={`py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  mobileTab === 'paper'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Paper ({paper.pageCount} pp.)
              </button>
            </div>
          </div>

          {/* Desktop 2-pane split workspace */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0">
            <div
              className={`lg:col-span-6 xl:col-span-5 min-h-0 ${
                mobileTab === 'paper' ? 'flex flex-col flex-1' : 'hidden lg:flex lg:flex-col'
              }`}
            >
              <PaperReader
                paper={paper}
                activePage={activePage}
                highlightedPage={highlightedPage}
                onSelectPage={(pageNum) => {
                  setActivePage(pageNum);
                  setHighlightedPage(null);
                }}
              />
            </div>

            <div
              className={`lg:col-span-6 xl:col-span-7 min-h-0 ${
                mobileTab === 'chat' ? 'flex flex-col flex-1' : 'hidden lg:flex lg:flex-col'
              }`}
            >
              <ChatPanel
                paper={paper}
                messages={messages}
                isStreaming={isStreaming}
                onSendMessage={handleSendMessage}
                onClearChat={() => setMessages([])}
                onJumpToPage={handleJumpToPage}
                onRetryLast={handleRetryLast}
              />
            </div>
          </div>
        </main>
      )}

      <GroundingModal
        open={groundingModalOpen}
        onClose={() => setGroundingModalOpen(false)}
      />
    </div>
  );
}
