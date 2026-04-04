# Contextly

Aplicação web em **Next.js** para conversar com seus documentos (**PDF** e **TXT**) usando **RAG (Retrieval-Augmented Generation)**: respostas fundamentadas nos trechos recuperados, com transparência de fontes e opcionalmente **rerank** via Cohere.

---

## Como funciona o RAG

### Visão geral

O modelo de linguagem **não** “memoriza” seus arquivos. Em cada pergunta, o sistema **recupera** trechos relevantes no banco e só então **gera** a resposta com base nesse contexto — reduzindo alucinação em cima do conteúdo dos documentos.

### 1. Ingestão (indexação)

1. **Upload** — Um ou vários arquivos são enviados para a API (`/api/upload`); cada arquivo é processado em uma requisição.
2. **Extração de texto** — PDFs passam por parser de texto; arquivos de texto são lidos diretamente.
3. **Chunking** — O texto é dividido em **blocos** (trechos) com metadados (arquivo, índice do chunk, página quando disponível).
4. **Embeddings** — Cada trecho é convertido em um vetor com o modelo **`text-embedding-3-small`** (OpenAI), **1536 dimensões**, em lotes.
5. **Armazenamento** — Gravação no **Supabase/PostgreSQL**:
   - tabela `documents` — metadados do arquivo;
   - tabela `embeddings` — texto do trecho, vetor (`pgvector`), `document_id` e `metadata` (JSON).
6. **Índice** — Índice **HNSW** com similaridade de **cosseno** para busca aproximada nos vetores.

### 2. Consulta (pergunta no chat)

1. **Embedding da pergunta** — A mensagem atual é vetorizada com o **mesmo** modelo usado na indexação.
2. **Busca vetorial** — A função SQL `match_embeddings` retorna os **K** trechos mais próximos por cosseno.  
   - Sem **Cohere**: em geral **K = 5** (esses trechos vão direto ao prompt).  
   - Com **Cohere Rerank** configurado: **K** maior (configurável, padrão ~20, limitado no app e no SQL), para dar **candidatos** ao rerank.
3. **Filtro de escopo** — Opcionalmente a busca restringe-se aos documentos **marcados** na interface; caso contrário usa a biblioteca inteira.
4. **Rerank (opcional)** — Se `COHERE_API_KEY` estiver definida, os **K** candidatos são reordenados pelo **Cohere Rerank** (ex.: `rerank-v3.5`); mantêm-se os **5** melhores para o contexto do LLM.
5. **Montagem do prompt** — Os trechos escolhidos viram um bloco **“Contexto”** com rótulos **[Fonte 1], [Fonte 2], …** + a pergunta. O histórico recente do chat pode ser enviado para **follow-ups**, mantendo a regra de fundamentar fatos no contexto recuperado.
6. **Geração** — Modelo de chat OpenAI (ex.: **gpt-4o**) produz a resposta em **português**, em **Markdown** quando aplicável.
7. **Stream** — A API envia eventos em **NDJSON**: metadados de **fontes** (similaridade vetorial e score de rerank quando houver), texto explicando o **raciocínio da recuperação**, depois os **tokens** da resposta.

### 3. O que não é

- Não é fine-tuning do modelo nos seus PDFs.
- A **semelhança vetorial** e o **score do rerank** medem **relevância na recuperação**, não “confiança” absoluta da resposta final.

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| App & API | Next.js (App Router), React |
| Banco & vetores | Supabase, PostgreSQL, **pgvector** |
| Embeddings & chat | OpenAI |
| Rerank (opcional) | Cohere |

---

## Configuração

1. Copie `.env.example` para `.env` e preencha as variáveis.
2. No **Supabase**, execute o script em `supabase/schema.sql` (SQL Editor) para criar tabelas, índice e função `match_embeddings`.
3. Instale dependências e rode o projeto:

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

### Variáveis principais

- `OPENAI_API_KEY` — obrigatória (embeddings + chat).
- `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` — obrigatórias (somente servidor; não exponha a service role no client).
- `COHERE_API_KEY` — opcional; ativa rerank e aumenta o pool de candidatos vetoriais.
- `RAG_VECTOR_CANDIDATES`, `COHERE_RERANK_MODEL` — opcionais; ver `.env.example`.

---

## Estrutura (RAG)

| Caminho | Papel |
|---------|--------|
| `src/app/api/upload/route.ts` | Ingestão: extrair → chunkar → embedar → gravar |
| `src/app/api/query/route.ts` | Consulta: embedar pergunta → buscar → rerank → LLM → stream |
| `src/lib/rag/chunk.ts` | Divisão em trechos |
| `src/lib/rag/embeddings.ts` | Chamadas de embedding OpenAI |
| `src/lib/rag/search.ts` | RPC `match_embeddings` |
| `src/lib/rag/rerank.ts` | Cohere Rerank (opcional) |
| `src/lib/rag/prompt.ts` | Prompt de sistema e template de contexto |
| `supabase/schema.sql` | DDL + `match_embeddings` |

---

## Scripts

```bash
npm run dev    # desenvolvimento
npm run build  # build de produção
npm run start  # servir build
npm run lint   # ESLint
```

---

## Deploy

Compatível com hospedagens Node para Next.js (ex.: **Vercel**). Configure as mesmas variáveis de ambiente no painel do provedor; não commite `.env`.
