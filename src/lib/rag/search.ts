import type { SupabaseClient } from "@supabase/supabase-js";

export type MatchRow = {
  id: string;
  document_id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
};

export async function searchSimilarChunks(
  supabase: SupabaseClient,
  queryEmbedding: number[],
  options: { matchCount?: number; documentIds?: string[] | null }
): Promise<MatchRow[]> {
  const matchCount = options.matchCount ?? 5;
  const filter =
    options.documentIds && options.documentIds.length > 0
      ? options.documentIds
      : null;

  const { data, error } = await supabase.rpc("match_embeddings", {
    query_embedding: queryEmbedding,
    match_count: matchCount,
    filter_document_ids: filter,
  });

  if (error) throw error;
  return (data ?? []) as MatchRow[];
}
