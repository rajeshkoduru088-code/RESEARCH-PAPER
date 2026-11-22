import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response } from 'express';
import multer from 'multer';
import { extractText, getMeta } from 'unpdf';
import {
  streamGroundedPaperAnswer,
  type ChatHistoryTurn,
  type PaperPage,
} from './server/gemini.js';
import { generateSampleResearchPaperPdf } from './server/samplePaper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface StoredPaper {
  paperId: string;
  fileName: string;
  title: string;
  author: string;
  pageCount: number;
  wordCount: number;
  pages: PaperPage[];
  isScannedFallback: boolean;
  pdfBase64?: string;
  pdfBytes: Buffer;
  createdAt: number;
}

const MAX_STORED_PAPERS = 25;
const paperStore = new Map<string, StoredPaper>();

function storePaper(paper: StoredPaper): void {
  if (paperStore.size >= MAX_STORED_PAPERS) {
    const oldestKey = paperStore.keys().next().value;
    if (oldestKey) {
      paperStore.delete(oldestKey);
    }
  }
  paperStore.set(paper.paperId, paper);
}

function cleanExtractedPageText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function inferTitleFromFirstPage(pageText: string, fallbackFileName: string): string {
  const lines = pageText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 4 && !/^page\s+\d+/i.test(line));

  if (lines.length > 0) {
    const candidate = lines[0];
    if (candidate.length <= 160) {
      return candidate;
    }
    return candidate.slice(0, 157).trim() + '...';
  }

  return fallbackFileName.replace(/\.pdf$/i, '');
}

async function parsePdfToPaper(
  pdfBuffer: Buffer,
  originalFileName: string
): Promise<StoredPaper> {
  // Verify PDF header signature
  const header = pdfBuffer.subarray(0, 5).toString('ascii');
  if (header !== '%PDF-') {
    throw new Error('The uploaded file does not appear to be a valid PDF document.');
  }

  // Pass fresh Uint8Array copies so PDF.js cannot detach the original buffer
  const textResult = await extractText(new Uint8Array(pdfBuffer), {
    mergePages: false,
  });

  let metaTitle = '';
  let metaAuthor = '';
  try {
    const metaResult = await getMeta(new Uint8Array(pdfBuffer));
    metaTitle = typeof metaResult.info?.Title === 'string' ? metaResult.info.Title.trim() : '';
    metaAuthor =
      typeof metaResult.info?.Author === 'string' ? metaResult.info.Author.trim() : '';
  } catch {
    // Metadata extraction is optional; continue with text extraction
  }

  const rawPages = Array.isArray(textResult.text) ? textResult.text : [String(textResult.text || '')];
  const pages: PaperPage[] = rawPages.map((pageRaw, index) => ({
    pageNumber: index + 1,
    text: cleanExtractedPageText(pageRaw),
  }));

  const combinedText = pages.map((p) => p.text).join(' ').trim();
  const wordCount = combinedText ? combinedText.split(/\s+/).length : 0;
  const isScannedFallback = wordCount < 25;

  const inferredTitle =
    metaTitle && metaTitle.toLowerCase() !== 'untitled'
      ? metaTitle
      : inferTitleFromFirstPage(pages[0]?.text || '', originalFileName);

  const paperId = crypto.randomUUID();
  const stored: StoredPaper = {
    paperId,
    fileName: originalFileName,
    title: inferredTitle,
    author: metaAuthor,
    pageCount: textResult.totalPages || pages.length,
    wordCount,
    pages,
    isScannedFallback,
    pdfBase64:
      isScannedFallback && pdfBuffer.byteLength <= 15 * 1024 * 1024
        ? pdfBuffer.toString('base64')
        : undefined,
    pdfBytes: pdfBuffer,
    createdAt: Date.now(),
  };

  storePaper(stored);
  return stored;
}

function serializePaperResponse(paper: StoredPaper) {
  return {
    paperId: paper.paperId,
    fileName: paper.fileName,
    title: paper.title,
    author: paper.author,
    pageCount: paper.pageCount,
    wordCount: paper.wordCount,
    isScannedFallback: paper.isScannedFallback,
    pages: paper.pages,
  };
}

function formatGeminiError(error: unknown): { status: number; message: string } {
  const err = error as { status?: number; message?: string; code?: string };
  const rawMessage = err?.message || 'An unexpected error occurred while querying the model.';

  if (
    rawMessage.includes('API_KEY_INVALID') ||
    rawMessage.includes('PERMISSION_DENIED') ||
    err?.status === 403
  ) {
    return {
      status: 403,
      message:
        'Gemini API access could not be verified. Please check your API key in the Settings > Secrets panel.',
    };
  }

  if (rawMessage.includes('RESOURCE_EXHAUSTED') || err?.status === 429) {
    return {
      status: 429,
      message:
        'API rate limit reached. Please wait a moment before sending another question.',
    };
  }

  return {
    status: err?.status && err.status >= 400 && err.status < 600 ? err.status : 500,
    message: rawMessage,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 25 * 1024 * 1024, // 25 MB max PDF
    },
    fileFilter: (_req, file, cb) => {
      const isPdfMime =
        file.mimetype === 'application/pdf' ||
        file.originalname.toLowerCase().endsWith('.pdf');
      if (!isPdfMime) {
        cb(new Error('Only PDF files (.pdf) are supported.'));
        return;
      }
      cb(null, true);
    },
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post('/api/papers/upload', (req: Request, res: Response) => {
    upload.single('file')(req, res, async (uploadErr: unknown) => {
      if (uploadErr) {
        const msg =
          uploadErr instanceof Error ? uploadErr.message : 'Failed to upload PDF file.';
        res.status(400).json({ error: msg });
        return;
      }

      if (!req.file || !req.file.buffer) {
        res.status(400).json({ error: 'Please select a PDF file to upload.' });
        return;
      }

      try {
        const paper = await parsePdfToPaper(req.file.buffer, req.file.originalname);
        res.json(serializePaperResponse(paper));
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to extract text from this PDF file.';
        res.status(422).json({ error: message });
      }
    });
  });

  app.post('/api/papers/sample', async (_req: Request, res: Response) => {
    try {
      const sampleBytes = generateSampleResearchPaperPdf();
      const paper = await parsePdfToPaper(
        Buffer.from(sampleBytes),
        'evidencerag_scientific_qa_2025.pdf'
      );
      res.json(serializePaperResponse(paper));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate sample paper PDF.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/papers/:paperId/pdf', (req: Request, res: Response) => {
    const paperId = Array.isArray(req.params.paperId)
      ? req.params.paperId[0]
      : req.params.paperId;
    const paper = paperStore.get(paperId);
    if (!paper) {
      res.status(404).json({ error: 'Paper not found.' });
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${paper.fileName.replace(/"/g, '')}"`
    );
    res.send(paper.pdfBytes);
  });

  app.post('/api/chat/stream', async (req: Request, res: Response) => {
    const { paperId, question, history, fallbackPaper } = req.body as {
      paperId?: string;
      question?: string;
      history?: ChatHistoryTurn[];
      fallbackPaper?: {
        title: string;
        fileName: string;
        pages: PaperPage[];
      };
    };

    const trimmedQuestion = typeof question === 'string' ? question.trim() : '';
    if (!trimmedQuestion) {
      res.status(400).json({ error: 'Please enter a question.' });
      return;
    }

    const stored = paperId ? paperStore.get(paperId) : undefined;
    const activeTitle = stored?.title || fallbackPaper?.title;
    const activeFileName = stored?.fileName || fallbackPaper?.fileName;
    const activePages = stored?.pages || fallbackPaper?.pages;

    if (!activePages || activePages.length === 0 || !activeTitle || !activeFileName) {
      res.status(404).json({
        error: 'No active paper found. Please upload your research paper PDF again.',
      });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      let fullText = '';
      const validHistory = Array.isArray(history)
        ? history.filter(
            (m) =>
              (m.role === 'user' || m.role === 'assistant') &&
              typeof m.content === 'string' &&
              m.content.trim().length > 0
          )
        : [];

      const stream = streamGroundedPaperAnswer({
        title: activeTitle,
        fileName: activeFileName,
        pages: activePages,
        pdfBase64: stored?.pdfBase64,
        isScannedFallback: stored?.isScannedFallback,
        history: validHistory,
        question: trimmedQuestion,
      });

      for await (const chunk of stream) {
        fullText += chunk;
        sendEvent({ type: 'chunk', text: chunk });
      }

      const normalized = fullText.toLowerCase();
      const notInPaper = normalized.includes('this is not mentioned in the paper');

      sendEvent({
        type: 'done',
        fullText: fullText.trim() || 'This is not mentioned in the paper.',
        notInPaper,
      });
      res.end();
    } catch (err) {
      const formatted = formatGeminiError(err);
      sendEvent({
        type: 'error',
        status: formatted.status,
        message: formatted.message,
      });
      res.end();
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('/{*splat}', (_req: Request, res: Response) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`FolioQA server listening on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
