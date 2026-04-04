import { getEncoding, type Tiktoken } from "js-tiktoken";

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 150;

let enc: Tiktoken | null = null;

function getEncoder(): Tiktoken {
  if (!enc) enc = getEncoding("cl100k_base");
  return enc;
}

export type TextChunk = {
  content: string;
  metadata: {
    fileName: string;
    chunkIndex: number;
    page: number | null;
    tokenCount: number;
  };
};

/**
 * Splits text into overlapping token windows (cl100k_base), ~500–1000 token target with ~100–200 overlap.
 */
export function chunkText(
  text: string,
  fileName: string,
  page: number | null = null
): TextChunk[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const encoder = getEncoder();
  const tokens = encoder.encode(normalized);
  const chunks: TextChunk[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < tokens.length) {
    const end = Math.min(start + CHUNK_SIZE, tokens.length);
    const slice = tokens.slice(start, end);
    const content = encoder.decode(slice).trim();
    if (content.length > 0) {
      chunks.push({
        content,
        metadata: {
          fileName,
          chunkIndex,
          page,
          tokenCount: slice.length,
        },
      });
      chunkIndex += 1;
    }
    if (end >= tokens.length) break;
    start = Math.max(0, end - CHUNK_OVERLAP);
  }

  return chunks;
}
