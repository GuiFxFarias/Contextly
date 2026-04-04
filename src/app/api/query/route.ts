import OpenAI from "openai";
import { NextResponse } from "next/server";
import { embedQuery } from "@/lib/rag/embeddings";
import {
  buildUserPrompt,
  formatChunksForPrompt,
  SYSTEM_PROMPT,
} from "@/lib/rag/prompt";
import { buildRetrievalReasoning } from "@/lib/rag/reasoning";
import { rerankMatches, rerankModelId, vectorCandidateCount } from "@/lib/rag/rerank";
import { searchSimilarChunks } from "@/lib/rag/search";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const CONTEXT_TOP_N = 5;

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o";

type SourcePayload = {
  id: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  preview: string;
  similarity: number;
  /** Relevância Cohere Rerank [0,1]; ausente se rerank não configurado. */
  rerankScore?: number;
};

type ChatHistoryItem = { role: "user" | "assistant"; content: string };

const MAX_HISTORY_MESSAGES = 24;

function sanitizeHistory(raw: unknown): ChatHistoryItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatHistoryItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const trimmed = content.trim();
    if (!trimmed) continue;
    out.push({ role, content: trimmed });
  }
  return out.slice(-MAX_HISTORY_MESSAGES);
}

function ndjsonLine(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(obj)}\n`);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      message?: string;
      documentIds?: string[] | null;
      history?: unknown;
    };
    const history = sanitizeHistory(body.history);
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json({ error: "É necessário enviar uma mensagem." }, { status: 400 });
    }

    let documentIds: string[] | null = null;
    if (Array.isArray(body.documentIds)) {
      if (body.documentIds.length === 0) {
        return NextResponse.json(
          {
            error:
              "Selecione pelo menos um documento para buscar ou marque todos para usar a biblioteca inteira.",
          },
          { status: 400 }
        );
      }
      documentIds = body.documentIds;
    }

    const supabase = getSupabaseAdmin();
    const queryEmbedding = await embedQuery(message);
    const vectorPool = vectorCandidateCount();
    const vectorMatches = await searchSimilarChunks(supabase, queryEmbedding, {
      matchCount: vectorPool,
      documentIds,
    });

    if (!vectorMatches.length) {
      const reasoning = buildRetrievalReasoning({
        model: MODEL,
        documentIds,
        matchCount: 0,
        documentNamesInMatches: [],
        userQuestionPreview: message,
      });
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            ndjsonLine({
              type: "sources",
              sources: [] as SourcePayload[],
              reasoning,
            })
          );
          controller.enqueue(
            ndjsonLine({
              type: "text",
              text: "Não sei com base nas informações fornecidas.",
            })
          );
          controller.enqueue(ndjsonLine({ type: "done" }));
          controller.close();
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    const { matches, rerankScores } = await rerankMatches(
      message,
      vectorMatches,
      CONTEXT_TOP_N
    );

    const docIds = [...new Set(matches.map((m) => m.document_id))];
    const { data: docs } = await supabase
      .from("documents")
      .select("id, name")
      .in("id", docIds);
    const nameById = new Map(
      (docs ?? []).map((d) => [d.id as string, d.name as string])
    );

    const formatted = formatChunksForPrompt(
      matches.map((m) => ({
        content: m.content,
        metadata: m.metadata as Record<string, unknown>,
        documentName: nameById.get(m.document_id),
      }))
    );

    const userContent = buildUserPrompt(formatted, message);

    const sources: SourcePayload[] = matches.map((m, i) => {
      const meta = m.metadata as Record<string, unknown>;
      const chunkIndex =
        typeof meta.chunkIndex === "number" ? meta.chunkIndex : 0;
      const rerankScore = rerankScores?.[i];
      return {
        id: m.id,
        documentId: m.document_id,
        documentName: nameById.get(m.document_id) ?? "Documento",
        chunkIndex,
        preview: m.content.slice(0, 200).replace(/\s+/g, " ").trim(),
        similarity: m.similarity,
        ...(rerankScore !== undefined ? { rerankScore } : {}),
      };
    });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Configure OPENAI_API_KEY no ambiente." },
        { status: 500 }
      );
    }
    const openai = new OpenAI({ apiKey });

    const completionStream = await openai.chat.completions.create({
      model: MODEL,
      stream: true,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: userContent },
      ],
    });

    const reasoning = buildRetrievalReasoning({
      model: MODEL,
      documentIds,
      matchCount: matches.length,
      documentNamesInMatches: matches.map(
        (m) => nameById.get(m.document_id) ?? "Documento"
      ),
      userQuestionPreview: message,
      cohereRerank:
        rerankScores && vectorMatches.length > 0
          ? {
              rerankModel: rerankModelId(),
              vectorPool: vectorMatches.length,
              finalCount: matches.length,
            }
          : null,
    });

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          ndjsonLine({ type: "sources", sources, reasoning })
        );
        try {
          for await (const part of completionStream) {
            const delta = part.choices[0]?.delta?.content;
            if (delta) controller.enqueue(ndjsonLine({ type: "text", text: delta }));
          }
          controller.enqueue(ndjsonLine({ type: "done" }));
        } catch (err) {
          console.error(err);
          controller.enqueue(
            ndjsonLine({
              type: "error",
              message: "Não foi possível concluir a resposta do assistente.",
            })
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha na consulta.";
    console.error(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
