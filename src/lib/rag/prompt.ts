export const SYSTEM_PROMPT = `Você é o assistente do Contextly. A última mensagem do usuário traz um bloco "Contexto" com trechos recuperados; use-o para todas as afirmações factuais sobre os documentos.
Use mensagens anteriores só para entender follow-ups (por exemplo, a que "isso" se refere). Não trate respostas passadas do assistente como fonte independente da verdade.
Se a resposta não estiver no bloco Contexto, diga exatamente: "Não sei com base nas informações fornecidas."
Responda sempre em português do Brasil. Formate em Markdown: use ## ou ### para seções curtas, listas (- ou 1.) quando organizar itens, **negrito** para termos-chave, parágrafos separados por linha em branco; use bloco de código (triple backtick) só quando o contexto trouxer trecho técnico ou literal a citar.
Cite as fontes pelos rótulos do Contexto (ex.: [Fonte 1]). Não invente fatos.`;

export function buildUserPrompt(retrievedChunks: string[], userQuestion: string): string {
  const contextBlock = retrievedChunks.join("\n\n");
  return `Contexto:\n${contextBlock}\n\nPergunta:\n${userQuestion}\n\nResponda em português do Brasil em Markdown bem estruturado (títulos, listas, negrito quando útil) e cite [Fonte N] quando usar cada trecho.`;
}

export function formatChunksForPrompt(
  rows: { content: string; metadata: Record<string, unknown>; documentName?: string }[]
): string[] {
  return rows.map((row, i) => {
    const meta = row.metadata ?? {};
    const name =
      (typeof meta.fileName === "string" && meta.fileName) ||
      row.documentName ||
      "documento";
    const chunk =
      typeof meta.chunkIndex === "number" ? meta.chunkIndex + 1 : i + 1;
    const page =
      typeof meta.page === "number" && meta.page > 0 ? `, pág. ${meta.page}` : "";
    const label = `[Fonte ${i + 1}: ${name}, trecho ${chunk}${page}]`;
    return `${label}\n${row.content.trim()}`;
  });
}
