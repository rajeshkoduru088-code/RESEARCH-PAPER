/**
 * Generates a genuine, valid multi-page PDF-1.4 document in memory
 * so students can test the exact PDF extraction and Gemini Q&A pipeline
 * even before uploading their own paper.
 */

interface SamplePageSpec {
  heading: string;
  lines: string[];
}

const SAMPLE_PAGES: SamplePageSpec[] = [
  {
    heading: 'Verifiable Chain-of-Evidence Retrieval for Scientific QA',
    lines: [
      'Authors: Elena Vance, Marcus Chen, and Priya Nair (2025)',
      'Department of Computer Science, Northbridge Institute of Technology',
      '',
      'Abstract',
      'Students and researchers frequently struggle to verify factual claims across long',
      'scientific PDFs. Standard retrieval-augmented generation systems often hallucinate',
      'unsupported details or omit exact page provenance. We introduce EvidenceRAG, a',
      'two-stage retrieval and verification framework for long-horizon scientific question',
      'answering. Evaluated on our newly curated SciClaim-14K benchmark and PubMedQA-Ext,',
      'EvidenceRAG improves citation precision by 18.4 percentage points over dense',
      'retrieval baselines while reducing unsupported claims to 1.9 percent.',
      '',
      '1. Introduction',
      'Reading dense 15-page academic manuscripts requires tracking definitions, datasets,',
      'hyperparameters, and ablation outcomes scattered across non-adjacent sections.',
      'When language models answer questions about a paper without strict grounding',
      'constraints, they blend parametric pretraining knowledge with document text,',
      'producing plausible but unverified answers. Our work enforces sentence-level',
      'provenance checks before emitting any response to the reader.',
    ],
  },
  {
    heading: '2. Related Work and Problem Formulation',
    lines: [
      '2.1 Document-Grounded Question Answering',
      'Prior systems such as Longformer-QA and FiD-Light encode multi-page documents',
      'using sparse attention windows up to 4,096 tokens. However, scientific papers',
      'routinely exceed 12,000 tokens when tables, appendices, and references are',
      'included. Truncating context causes silent omissions on experimental setup pages.',
      '',
      '2.2 Hallucination Mitigation in Scholarly Assistants',
      'Recent abstention benchmarks demonstrate that models instructed with generic',
      'prompts still fabricate metric values 14.2 percent of the time when asked about',
      'missing ablation studies. To address this, we formulate grounded PDF QA as a',
      'constrained entailment problem: every output proposition p must be entailed by',
      'at least one extracted page span s_i in pages {1, ..., N}. If no span entails',
      'the query, the system must abstain explicitly rather than speculate.',
    ],
  },
  {
    heading: '3. Datasets and Benchmark Construction',
    lines: [
      '3.1 Primary Dataset: SciClaim-14K',
      'We constructed SciClaim-14K, a collection of 1,420 peer-reviewed computer science',
      'and biomedical papers totaling 14,180 question-answer pairs. Papers average 14.6',
      'pages in length and span machine learning, bioinformatics, and climate modeling.',
      'Each question was authored by graduate students and paired with exact page',
      'annotations. Importantly, 22 percent of SciClaim-14K queries are unanswerable',
      'adversarial questions whose answers are intentionally absent from the PDF.',
      '',
      '3.2 Secondary Evaluation Dataset: PubMedQA-Ext',
      'To test cross-domain generalization without fine-tuning, we evaluate zero-shot on',
      'PubMedQA-Ext, a full-text extension of PubMedQA comprising 2,500 clinical trial',
      'manuscripts. We exclude papers published prior to 2018 to avoid OCR artifacts.',
      'No proprietary medical datasets or closed commercial corpora were used.',
    ],
  },
  {
    heading: '4. Methodology: EvidenceRAG Architecture',
    lines: [
      '4.1 Page-Indexed Parsing and Chunking',
      'Each uploaded PDF is parsed page-by-page using deterministic text extraction,',
      'preserving explicit [Page k] markers. Text is segmented into overlapping 320-token',
      'passages with a 64-token stride so equations and table captions remain intact.',
      '',
      '4.2 Dual-Stage Hybrid Retriever',
      'Stage 1 combines BM25 lexical matching (k1 = 1.5, b = 0.75) with SciBERT-v2',
      'dense embeddings using Reciprocal Rank Fusion (RRF) to retrieve top-12 candidates.',
      'Stage 2 applies a cross-encoder reranker trained with contrastive margin loss to',
      'select the top-5 evidence spans alongside their page indices.',
      '',
      '4.3 Entailment Verifier and Abstention Gate',
      'Before returning an answer, the verifier computes a calibrated entailment score.',
      'If the maximum support score across all retrieved spans falls below threshold',
      'tau = 0.62, the system triggers an abstention gate and outputs a fixed refusal.',
    ],
  },
  {
    heading: '5. Experimental Setup and Quantitative Results',
    lines: [
      '5.1 Implementation and Training Hyperparameters',
      'All models were trained using AdamW with a learning rate of 2e-5, linear warmup',
      'over 10 percent of steps, batch size 32, and weight decay 0.01 for 4 epochs.',
      'Experiments ran on 4 NVIDIA A100 (80GB) GPUs with total training time of 9.5 hours.',
      '',
      '5.2 Main Results on SciClaim-14K and PubMedQA-Ext',
      'Baseline BM25 + Reader achieved 61.3% F1 and 68.0% citation precision.',
      'Dense DPR + Reader achieved 67.8% F1 and 73.5% citation precision.',
      'EvidenceRAG (ours) achieved 81.4% F1, 91.9% citation precision, and 94.6%',
      'unanswerable abstention accuracy on SciClaim-14K. On zero-shot PubMedQA-Ext,',
      'EvidenceRAG reached 77.2% F1 compared to 63.9% for the strongest baseline.',
      '',
      '5.3 Ablation Study',
      'Removing the cross-encoder reranker dropped F1 by 5.1 points (from 81.4% to 76.3%).',
      'Removing the abstention gate caused unsupported hallucination rate to rise from',
      '1.9 percent to 11.7 percent on adversarial unanswerable questions.',
    ],
  },
  {
    heading: '6. Limitations and Conclusion',
    lines: [
      '6.1 Limitations',
      'First, our text extraction pipeline does not parse complex vector figures or',
      'scatter plots without captions, meaning numerical trends encoded solely inside',
      'rasterized charts cannot be queried reliably. Second, EvidenceRAG relies on',
      'English-language scientific benchmarks and has not been evaluated on multilingual',
      'or non-Latin-script manuscripts. Third, multi-document synthesis across separate',
      'PDF files is left for future work.',
      '',
      '6.2 Conclusion',
      'We presented EvidenceRAG, a verifiable retrieval and abstention framework for',
      'answering student questions strictly from uploaded research paper PDFs. By',
      'coupling hybrid page-indexed retrieval with an entailment abstention gate, the',
      'system delivers high factual precision and transparent page provenance.',
    ],
  },
];

function escapePdfText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, ' ');
}

function buildPageStream(page: SamplePageSpec, pageNumber: number, totalPages: number): string {
  const commands: string[] = [];
  commands.push('BT');
  // Header title on page
  commands.push('/F2 13 Tf');
  commands.push('54 742 Td');
  commands.push(`(${escapePdfText(page.heading)}) Tj`);

  // Body lines
  commands.push('/F1 10.5 Tf');
  commands.push('0 -24 Td');
  for (const line of page.lines) {
    if (line.trim() === '') {
      commands.push('0 -10 Td');
    } else {
      commands.push(`(${escapePdfText(line)}) Tj`);
      commands.push('0 -15 Td');
    }
  }
  commands.push('ET');

  // Footer page number
  commands.push('BT');
  commands.push('/F1 9 Tf');
  commands.push('275 36 Td');
  commands.push(`(Page ${pageNumber} of ${totalPages}) Tj`);
  commands.push('ET');

  return commands.join('\n');
}

export function generateSampleResearchPaperPdf(): Uint8Array {
  const totalPages = SAMPLE_PAGES.length;
  // Object layout:
  // 1: Catalog
  // 2: Pages
  // 3: Font F1 (Helvetica)
  // 4: Font F2 (Helvetica-Bold)
  // 5: Info
  // For each page i (0..totalPages-1):
  //   pageObj = 6 + i * 2
  //   contentObj = 7 + i * 2

  const objects: string[] = [];
  const pageObjNums: number[] = [];

  for (let i = 0; i < totalPages; i++) {
    pageObjNums.push(6 + i * 2);
  }

  // 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  // 2: Pages
  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${totalPages} >>\nendobj\n`
  );
  // 3: Regular Font
  objects.push(
    '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'
  );
  // 4: Bold Font
  objects.push(
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n'
  );
  // 5: Info
  objects.push(
    '5 0 obj\n<< /Title (Verifiable Chain-of-Evidence Retrieval for Scientific QA) /Author (Elena Vance, Marcus Chen, Priya Nair) >>\nendobj\n'
  );

  for (let i = 0; i < totalPages; i++) {
    const pageObjNum = 6 + i * 2;
    const contentObjNum = 7 + i * 2;
    const stream = buildPageStream(SAMPLE_PAGES[i], i + 1, totalPages);
    const streamByteLength = Buffer.byteLength(stream, 'utf8');

    objects.push(
      `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjNum} 0 R >>\nendobj\n`
    );
    objects.push(
      `${contentObjNum} 0 obj\n<< /Length ${streamByteLength} >>\nstream\n${stream}\nendstream\nendobj\n`
    );
  }

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0]; // object 0 is free

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${offsets.length}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return new Uint8Array(Buffer.from(pdf, 'utf8'));
}
