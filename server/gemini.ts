import { GoogleGenAI, ThinkingLevel, type Content } from '@google/genai';

export interface PaperPage {
  pageNumber: number;
  text: string;
}

export interface ChatHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please check the Settings > Secrets panel.'
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const STRICT_SYSTEM_INSTRUCTION = `You are a strict academic research paper Q&A assistant.
Your ONLY source of truth is the research paper provided in the conversation context.

CRITICAL GROUNDING RULES:
1. Answer questions using ONLY facts, numbers, datasets, methods, and claims explicitly stated in the provided research paper.
2. NEVER use outside knowledge, general background facts, assumptions, or information from other papers.
3. If the answer to the user's question is NOT stated in the provided paper, reply with the exact phrase:
This is not mentioned in the paper.
4. Do not hedge or invent plausible details when information is absent. If only part of a question is answered in the paper, answer ONLY the part present with citations, and explicitly state "This is not mentioned in the paper." for the missing part.
5. Whenever you state information from the paper, cite the exact page number(s) inline in square brackets using this exact format: [Page X] (for example: [Page 3] or [Page 4], [Page 5]). Never cite a page number that does not exist in the paper.
6. Write clearly and concisely for a student reading the paper. Use short paragraphs or bullet points when helpful.`;

function formatPaperDocumentContext(
  title: string,
  fileName: string,
  pages: PaperPage[]
): string {
  const maxPagesToSend = pages.slice(0, 60);
  const formattedPages = maxPagesToSend
    .map((p) => {
      const cleaned = p.text.trim();
      return `=== [Page ${p.pageNumber}] ===\n${cleaned || '(No selectable text on this page)'}`;
    })
    .join('\n\n');

  return `RESEARCH PAPER METADATA:
Title: ${title}
Filename: ${fileName}
Total Pages: ${pages.length}

FULL EXTRACTED PAPER TEXT BY PAGE:
${formattedPages}`;
}

export async function* streamGroundedPaperAnswer(params: {
  title: string;
  fileName: string;
  pages: PaperPage[];
  pdfBase64?: string;
  isScannedFallback?: boolean;
  history: ChatHistoryTurn[];
  question: string;
}): AsyncGenerator<string, void, unknown> {
  const ai = getAiClient();
  const { title, fileName, pages, pdfBase64, isScannedFallback, history, question } =
    params;

  const contents: Content[] = [];

  // Seed turn 1 with the full paper context (either page-indexed text or multimodal PDF if scanned)
  if (isScannedFallback && pdfBase64) {
    contents.push({
      role: 'user',
      parts: [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: pdfBase64,
          },
        },
        {
          text: `Here is the research paper "${title}" (${fileName}, ${pages.length} pages). Read it carefully and answer all following questions strictly from this PDF only, citing [Page X] where possible.`,
        },
      ],
    });
  } else {
    contents.push({
      role: 'user',
      parts: [
        {
          text: formatPaperDocumentContext(title, fileName, pages),
        },
      ],
    });
  }

  contents.push({
    role: 'model',
    parts: [
      {
        text: 'I have read the uploaded research paper. I will answer questions strictly using only its contents with [Page X] citations, and if something is not in the paper, I will reply: "This is not mentioned in the paper."',
      },
    ],
  });

  // Append recent prior turns so follow-up questions ("What about their learning rate?") work naturally
  const recentHistory = history.slice(-12);
  for (const turn of recentHistory) {
    contents.push({
      role: turn.role === 'user' ? 'user' : 'model',
      parts: [{ text: turn.content }],
    });
  }

  // Append current student question
  contents.push({
    role: 'user',
    parts: [{ text: question }],
  });

  const stream = await ai.models.generateContentStream({
    model: 'gemini-4-hydrogen',
    contents,
    config: {
      systemInstruction: STRICT_SYSTEM_INSTRUCTION,
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW,
      },
    },
  });

  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) {
      yield text;
    }
  }
}
