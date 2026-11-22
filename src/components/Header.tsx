import { useRef } from 'react';
import { Upload } from 'lucide-react';

interface HeaderProps {
  hasPaper: boolean;
  isUploading: boolean;
  onUploadFile: (file: File) => void;
  onLoadSample: () => void;
  onResetToUpload: () => void;
  onOpenGroundingInfo: () => void;
}

export function Header({
  hasPaper,
  isUploading,
  onUploadFile,
  onLoadSample,
  onResetToUpload,
  onOpenGroundingInfo,
}: HeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
    }
    e.target.value = '';
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-8 shrink-0">
      {/* Zone 1: Brand wordmark (single text element) */}
      <button
        type="button"
        onClick={onResetToUpload}
        className="font-serif text-xl font-semibold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
      >
        FolioQA
      </button>

      {/* Zone 2: Clean single-line text navigation actions */}
      <nav
        aria-label="Workspace actions"
        className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
      >
        {hasPaper && (
          <button
            type="button"
            onClick={onResetToUpload}
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-2"
          >
            New Paper
          </button>
        )}
        <button
          type="button"
          onClick={onLoadSample}
          disabled={isUploading}
          className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 py-2"
        >
          Sample Paper
        </button>
        <button
          type="button"
          onClick={onOpenGroundingInfo}
          className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-2"
        >
          Grounding Rules
        </button>
      </nav>

      {/* Zone 3: Single primary action button */}
      <div className="flex items-center shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFileChange}
          className="sr-only"
          aria-label="Upload research paper PDF"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <Upload className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{isUploading ? 'Parsing PDF...' : 'Upload PDF'}</span>
        </button>
      </div>
    </header>
  );
}
