import { useEffect } from 'react';
import { X, ShieldCheck, BookOpenCheck, Ban } from 'lucide-react';

interface GroundingModalProps {
  open: boolean;
  onClose: () => void;
}

export function GroundingModal({ open, onClose }: GroundingModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="grounding-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2
              id="grounding-modal-title"
              className="font-serif text-xl font-semibold text-slate-900"
            >
              Strict Paper Grounding Rules
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              How FolioQA keeps answers verifiable while you read.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close grounding rules"
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-5 space-y-5 text-sm text-slate-700">
          <div className="flex items-start gap-3">
            <BookOpenCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-slate-900">Page-by-page citation links</h3>
              <p className="text-slate-600 mt-0.5 leading-relaxed">
                Every uploaded PDF is extracted page-by-page. Answers include clickable{' '}
                <span className="font-mono text-xs text-blue-700">[Page X]</span> references
                that jump the document reader directly to that page.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Ban className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-slate-900">Explicit abstention on missing facts</h3>
              <p className="text-slate-600 mt-0.5 leading-relaxed">
                If a dataset, metric, or topic does not appear in the paper, the assistant does not
                guess from general knowledge—it responds with:{' '}
                <span className="font-medium text-slate-900">
                  &ldquo;This is not mentioned in the paper.&rdquo;
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-slate-900">Multi-turn context retention</h3>
              <p className="text-slate-600 mt-0.5 leading-relaxed">
                Follow-up questions stay grounded to the same PDF while keeping your full question
                and answer history visible on screen.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 min-h-[40px] text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
