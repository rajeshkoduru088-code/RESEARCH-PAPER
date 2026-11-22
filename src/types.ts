export interface PaperPage {
  pageNumber: number;
  text: string;
}

export interface PaperDocument {
  paperId: string;
  fileName: string;
  title: string;
  author: string;
  pageCount: number;
  wordCount: number;
  isScannedFallback: boolean;
  pages: PaperPage[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  notInPaper?: boolean;
  isStreaming?: boolean;
  error?: string;
}
