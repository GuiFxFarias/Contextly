export type RetrievalReasoning = {
  model: string;
  scopeLabel: string;
  steps: string[];
};

export function buildRetrievalReasoning(opts: {
  model: string;
  documentIds: string[] | null;
  matchCount: number;
  documentNamesInMatches: string[];
  userQuestionPreview: string;
  /** Quando definido, o texto menciona pool vetorial + Cohere Rerank. */
  cohereRerank?: { rerankModel: string; vectorPool: number; finalCount: number } | null;
}): RetrievalReasoning {
  const {
    model,
    documentIds,
    matchCount,
    documentNamesInMatches,
    userQuestionPreview,
    cohereRerank,
  } = opts;

  const preview =
    userQuestionPreview.length > 120
      ? `${userQuestionPreview.slice(0, 120)}…`
      : userQuestionPreview;

  let scopeLabel: string;
  if (documentIds === null) {
    scopeLabel = "Busca em toda a biblioteca";
  } else if (documentIds.length === 1) {
    scopeLabel = "Busca em 1 documento marcado na barra lateral";
  } else {
    scopeLabel = `Busca em ${documentIds.length} documentos marcados na barra lateral`;
  }

  const uniqueNames = [...new Set(documentNamesInMatches)].filter(Boolean);
  const namesStr = uniqueNames.length ? uniqueNames.join(", ") : "—";

  const steps =
    matchCount === 0
      ? [
          `Analisamos a pergunta: “${preview}”.`,
          "Convertemos essa pergunta em um vetor (embedding), no mesmo espaço usado quando seus arquivos foram indexados.",
          `${scopeLabel}.`,
          "Nenhum trecho ficou similar o suficiente para montar contexto — pode não haver assunto relacionado nos documentos do escopo, ou a redação é bem diferente do texto indexado.",
        ]
      : cohereRerank
        ? [
            `Analisamos a pergunta: “${preview}”.`,
            "Geramos o embedding da pergunta e buscamos candidatos por similaridade de cosseno no banco (pgvector / match_embeddings).",
            `${scopeLabel}.`,
            `Recuperamos até ${cohereRerank.vectorPool} trecho(s) candidatos; em seguida o Cohere Rerank (${cohereRerank.rerankModel}) reordenou pela relevância à pergunta e mantivemos os ${cohereRerank.finalCount} melhores para o contexto.`,
            `Arquivos nesses trechos: ${namesStr}.`,
            `Montamos o bloco “Contexto” (rótulos [Fonte 1], [Fonte 2], …) e enviamos ao modelo ${model}, que responde em português citando só o que está nesse contexto.`,
          ]
        : [
            `Analisamos a pergunta: “${preview}”.`,
            "Geramos o embedding da pergunta e ranqueamos trechos por similaridade de cosseno no banco (pgvector / função match_embeddings).",
            `${scopeLabel}.`,
            `Escolhemos os ${matchCount} trecho(s) mais próximos, vindos de ${uniqueNames.length} arquivo(s): ${namesStr}.`,
            `Montamos o bloco “Contexto” com esses trechos (rótulos [Fonte 1], [Fonte 2], …) e enviamos ao modelo ${model}, que responde em português citando só o que está nesse contexto.`,
          ];

  return { model, scopeLabel, steps };
}
