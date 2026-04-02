import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

export interface DocumentChunk {
  id: string;
  document_id: string;
  text: string;
  page_number: number;
  chunk_index: number;
}

export interface ParsedDocument {
  fileName: string;
  totalPages: number;
  chunks: Omit<DocumentChunk, 'document_id'>[];
  fullText: string;
}

/**
 * Extract text from a PDF and split into overlapping chunks for RAG.
 * Chunk size: ~500 chars with 100 char overlap for context continuity.
 */
export async function parsePdf(file: File): Promise<ParsedDocument> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: { pageNumber: number; text: string }[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => item.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push({ pageNumber: i, text });
  }

  const fullText = pages.map((p) => p.text).join("\n\n");
  const chunks: Omit<DocumentChunk, 'document_id'>[] = [];
  const CHUNK_SIZE = 500;
  const OVERLAP = 100;
  let chunkIdx = 0;

  for (const page of pages) {
    if (!page.text) continue;
    let start = 0;
    while (start < page.text.length) {
      const end = Math.min(start + CHUNK_SIZE, page.text.length);
      const text = page.text.slice(start, end).trim();
      if (text.length > 20) {
        chunks.push({
          id: `chunk-${chunkIdx}`,
          text,
          page_number: page.pageNumber,
          chunk_index: chunkIdx,
        });
        chunkIdx++;
      }
      start += CHUNK_SIZE - OVERLAP;
    }
  }

  return { fileName: file.name, totalPages: pdf.numPages, chunks, fullText };
}

/**
 * Hybrid retrieval: combines keyword-based scoring (BM25-like term frequency)
 * with basic semantic matching. For MVP, we use term frequency + phrase boost.
 * In production, this would be replaced with vector embeddings + BM25 from the DB.
 */
export function retrieveRelevantChunks(
  query: string,
  chunks: DocumentChunk[],
  topK: number = 5
): DocumentChunk[] {
  const queryTerms = query.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  // Remove common stop words for better matching
  const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out']);
  const filteredTerms = queryTerms.filter((t) => !stopWords.has(t));

  const scored = chunks.map((chunk) => {
    const lowerText = chunk.text.toLowerCase();
    let score = 0;

    // Term frequency scoring (BM25-inspired)
    for (const term of filteredTerms) {
      const regex = new RegExp(`\\b${term}\\b`, "gi");
      const matches = lowerText.match(regex);
      if (matches) {
        // Diminishing returns for repeated terms (like BM25's saturation)
        score += Math.log(1 + matches.length) * 2;
      }
    }

    // Exact phrase match boost
    if (lowerText.includes(query.toLowerCase())) {
      score += 15;
    }

    // Partial phrase match (consecutive terms)
    for (let i = 0; i < filteredTerms.length - 1; i++) {
      const bigram = `${filteredTerms[i]} ${filteredTerms[i + 1]}`;
      if (lowerText.includes(bigram)) {
        score += 5;
      }
    }

    return { chunk, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((s) => s.score > 0)
    .map((s) => s.chunk);
}
