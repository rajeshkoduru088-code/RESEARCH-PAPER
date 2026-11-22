import { useRef, useState } from 'react';
import { FileUp, FileText, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

interface UploadDropzoneProps {
  isUploading: boolean;
  uploadError: string | null;
  onUploadFile: (file: File) => void;
  onLoadSample: () => void;
}

export function UploadDropzone({
  isUploading,
  uploadError,
  onUploadFile,
  onLoadSample,
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isUploading) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isUploading) return;
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      onUploadFile(droppedFile);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
    }
    e.target.value = '';
  };

  return (
    <main className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          {/* Left column: Scholarly introduction & workflow overview */}
          <div className="lg:col-span-6 flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-blue-700 tracking-wide">
                Academic Paper Q&amp;A Workspace
              </p>
              <h1
                className="font-serif font-semibold text-slate-900 tracking-tight mt-3 leading-[1.15]"
                style={{
                  fontSize: 'clamp(2rem, 3.4vw, 2.85rem)',
                  textWrap: 'balance',
                }}
              >
                Read dense research papers without losing the thread.
              </h1>
              <p className="mt-4 text-base text-slate-600 leading-relaxed max-w-xl">
                Upload a 15-page manuscript or technical PDF and ask specific questions in plain
                English. Every answer is grounded strictly in your document with clickable page
                citations.
              </p>
            </div>

            <div className="mt-10 border-t border-slate-200 divide-y divide-slate-200">
              <div className="py-4">
                <h2 className="text-sm font-semibold text-slate-900">
                  01. Page-indexed PDF extraction
                </h2>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  Extracts every page sequentially so citations like{' '}
                  <span className="font-mono text-xs text-blue-700">[Page 4]</span> scroll straight
                  to the matching passage.
                </p>
              </div>
              <div className="py-4">
                <h2 className="text-sm font-semibold text-slate-900">
                  02. Zero outside speculation
                </h2>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  If the answer is absent from the PDF, the assistant states:{' '}
                  <span className="font-medium text-slate-800">
                    &ldquo;This is not mentioned in the paper.&rdquo;
                  </span>
                </p>
              </div>
              <div className="py-4">
                <h2 className="text-sm font-semibold text-slate-900">
                  03. Persistent Q&amp;A thread
                </h2>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  Ask follow-ups on datasets, baselines, hyperparameters, or limitations while
                  keeping the full conversation on screen.
                </p>
              </div>
            </div>
          </div>

          {/* Right column: Interactive PDF dropzone */}
          <div className="lg:col-span-6 flex flex-col justify-center">
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between h-full">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isUploading && inputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
                    e.preventDefault();
                    inputRef.current?.click();
                  }
                }}
                aria-label="Drop a research paper PDF here or click to browse"
                className={`flex-1 min-h-[280px] rounded-lg border-2 border-dashed transition-colors flex flex-col items-center justify-center text-center p-6 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  isDragging
                    ? 'border-blue-600 bg-blue-50/60'
                    : 'border-slate-300 bg-slate-50/60 hover:border-slate-400 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleInputChange}
                  className="sr-only"
                />

                {isUploading ? (
                  <>
                    <Loader2
                      className="w-9 h-9 text-blue-700 animate-spin"
                      aria-hidden="true"
                    />
                    <p className="mt-4 text-base font-semibold text-slate-900">
                      Extracting PDF pages...
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Indexing page text and preparing the Q&amp;A workspace.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-blue-700">
                      <FileUp className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <p className="mt-4 text-base font-semibold text-slate-900">
                      Drop your research paper PDF here
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      or click to browse from your computer (up to 25 MB)
                    </p>
                    <span className="mt-5 inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-lg bg-blue-700 text-white text-sm font-medium whitespace-nowrap shrink-0">
                      Select PDF File
                    </span>
                  </>
                )}
              </div>

              {uploadError && (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="mt-6 pt-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-sm text-slate-600">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                  <span>No paper handy? Try our 6-page sample PDF.</span>
                </div>
                <button
                  type="button"
                  onClick={onLoadSample}
                  disabled={isUploading}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] text-sm font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <span>Load Sample Paper</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
