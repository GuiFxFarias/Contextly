import { CohereClient } from "cohere-ai";
import type { MatchRow } from "@/lib/rag/search";

const DEFAULT_MODEL = "rerank-v3.5";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function isCohereRerankConfigured(): boolean {
  return Boolean(process.env.COHERE_API_KEY?.trim());
}

/** Quantos trechos a busca vetorial traz antes do rerank (só relevante com COHERE_API_KEY). */
export function vectorCandidateCount(): number {
  if (!isCohereRerankConfigured()) return 5;
  const raw = Number(process.env.RAG_VECTOR_CANDIDATES ?? 20);
  if (Number.isNaN(raw)) return 20;
  return clamp(raw, 5, 50);
}

export function rerankModelId(): string {
  return (process.env.COHERE_RERANK_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

/**
 * Reordena candidatos com Cohere Rerank. Sem API key, devolve os primeiros `topN` na ordem vetorial.
 */
export async function rerankMatches(
  query: string,
  matches: MatchRow[],
  topN: number
): Promise<{ matches: MatchRow[]; rerankScores: number[] | null }> {
  const token = process.env.COHERE_API_KEY?.trim();
  const take = Math.min(topN, matches.length);
  if (!token || matches.length === 0) {
    return {
      matches: matches.slice(0, take),
      rerankScores: null,
    };
  }

  const cohere = new CohereClient({ token });
  const model = rerankModelId();

  const res = await cohere.rerank({
    query,
    documents: matches.map((m) => m.content),
    topN: take,
    model,
  });

  const out: MatchRow[] = [];
  const scores: number[] = [];
  for (const r of res.results) {
    const row = matches[r.index];
    if (row) {
      out.push(row);
      scores.push(r.relevanceScore);
    }
  }

  return { matches: out, rerankScores: scores };
}
