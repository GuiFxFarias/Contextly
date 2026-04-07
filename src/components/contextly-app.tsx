"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  BrainCircuit,
  ChevronDown,
  FileText,
  FileUp,
  Loader2,
  SendHorizontal,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RetrievalReasoning } from "@/lib/rag/reasoning";
import { AssistantMarkdown } from "@/components/assistant-markdown";

type DocumentRow = {
  id: string;
  name: string;
  created_at: string;
};

type SourceInfo = {
  id: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  preview: string;
  similarity: number;
  rerankScore?: number;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceInfo[];
  reasoning?: RetrievalReasoning;
};

type QueryScope = { kind: "all" } | { kind: "subset"; ids: string[] };

function CollapsibleBlock({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      className="group max-w-[85%] overflow-hidden rounded-xl border border-border bg-muted/25 open:bg-muted/40"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-foreground transition-colors hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
        <Icon className="size-4 shrink-0 text-primary" aria-hidden />
        {title}
      </summary>
      <div className="border-t border-border/70 px-3 py-3 text-sm">{children}</div>
    </details>
  );
}

export function ContextlyApp({ embedded = false }: { embedded?: boolean } = {}) {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [queryScope, setQueryScope] = useState<QueryScope>({ kind: "all" });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  };

  const loadDocuments = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      const list = (data.documents ?? []) as DocumentRow[];
      setDocuments(list);
      setQueryScope((prev) => {
        if (prev.kind === "all") return prev;
        const allowed = new Set(list.map((d) => d.id));
        const ids = prev.ids.filter((id) => allowed.has(id));
        if (ids.length === 0) return { kind: "all" };
        if (ids.length === list.length) return { kind: "all" };
        return { kind: "subset", ids };
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  const onUploadClick = () => fileInputRef.current?.click();

  const onFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (list.length === 0) return;
    setUploading(true);
    const errors: string[] = [];
    try {
      for (const file of list) {
        try {
          const fd = new FormData();
          fd.set("file", file);
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Upload failed");
        } catch (err) {
          console.error(err);
          const msg = err instanceof Error ? err.message : "Falha no envio";
          errors.push(`${file.name}: ${msg}`);
        }
      }
      await loadDocuments();
      if (list.length > errors.length) {
        setQueryScope({ kind: "all" });
      }
      if (errors.length > 0) {
        const ok = list.length - errors.length;
        const header =
          ok > 0
            ? `${ok} arquivo(s) OK, ${errors.length} com erro:\n\n`
            : "Nenhum arquivo foi enviado:\n\n";
        alert(header + errors.join("\n"));
      }
    } finally {
      setUploading(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    if (queryScope.kind === "subset" && queryScope.ids.length === 0) {
      alert("Select at least one document, or use the full library (check all documents).");
      return;
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    const assistantId = crypto.randomUUID();
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setSending(true);

    setMessages((m) => [...m, { id: assistantId, role: "assistant", content: "" }]);

    const documentIds = queryScope.kind === "all" ? null : queryScope.ids;

    const history = messages
      .filter((m) => m.content.trim().length > 0)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content.trim(),
      }))
      .slice(-24);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, documentIds, history }),
      });

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? "Request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx = buf.indexOf("\n");
        while (idx !== -1) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          idx = buf.indexOf("\n");
          if (!line) continue;
          const evt = JSON.parse(line) as
            | {
                type: "sources";
                sources: SourceInfo[];
                reasoning?: RetrievalReasoning;
              }
            | { type: "text"; text: string }
            | { type: "done" }
            | { type: "error"; message: string };

          if (evt.type === "sources") {
            setMessages((prev) =>
              prev.map((x) =>
                x.id === assistantId
                  ? {
                      ...x,
                      sources: evt.sources,
                      reasoning: evt.reasoning ?? x.reasoning,
                    }
                  : x
              )
            );
          } else if (evt.type === "text") {
            setMessages((prev) =>
              prev.map((x) =>
                x.id === assistantId
                  ? { ...x, content: x.content + evt.text }
                  : x
              )
            );
          } else if (evt.type === "error") {
            setMessages((prev) =>
              prev.map((x) =>
                x.id === assistantId
                  ? { ...x, content: evt.message }
                  : x
              )
            );
          }
        }
      }
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setMessages((prev) =>
        prev.map((x) =>
          x.id === assistantId ? { ...x, content: msg } : x
        )
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={cn("flex h-screen w-full overflow-hidden bg-[#eef3f7]", embedded && "h-full bg-transparent")}>
      <aside
        className={cn(
          "hidden w-[124px] shrink-0 flex-col bg-[#0f4f79] text-white md:flex",
          embedded && "hidden md:hidden"
        )}
      >
        <div className="px-3 py-5">
          <div className="rounded-xl border border-white/20 px-2 py-3 text-center text-xs font-semibold">
            KOMVOS MIND
          </div>
        </div>
        <div className="px-2 text-[11px] text-white/70">Executive</div>
        <nav className="mt-2 space-y-1 px-2 text-sm">
          <div className="rounded bg-white/15 px-2 py-1.5">Agentes</div>
          <div className="px-2 py-1.5 text-white/90">Arquivos</div>
        </nav>
        <div className="mt-auto border-t border-white/15 p-2 text-[10px] text-white/80">
          Vinícius Otávio
        </div>
      </aside>

      <aside
        className={cn(
          "hidden w-[250px] shrink-0 border-r border-[#cad6df] bg-[#edf3f7] md:flex md:flex-col",
          embedded && "w-[260px]"
        )}
      >
        <div className="space-y-1 p-3 text-[12px] text-[#274f67]">
          <button
            className="flex w-full items-center rounded px-2 py-1 text-left hover:bg-white/60"
            onClick={() => {
              setMessages([]);
              setInput("");
            }}
          >
            Novo chat
          </button>
          <button className="flex w-full items-center rounded px-2 py-1 text-left hover:bg-white/60">
            Agentes
          </button>
          <button className="flex w-full items-center rounded px-2 py-1 text-left hover:bg-white/60">
            Buscar
          </button>
          <button className="flex w-full items-center rounded px-2 py-1 text-left hover:bg-white/60">
            Arquivos ({documents.length})
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.txt,text/plain,application/pdf"
            className="hidden"
            onChange={onFileSelected}
          />
          <Button
            onClick={onUploadClick}
            disabled={uploading}
            variant="outline"
            className="mt-2 h-7 w-full justify-start text-[11px]"
          >
            {uploading ? <Loader2 className="mr-1 size-3 animate-spin" /> : <FileUp className="mr-1 size-3" />}
            Enviar arquivos
          </Button>
        </div>
        <div className="px-3 pb-2 text-[11px] font-semibold text-[#274f67]">Chats</div>
        <ScrollArea className="min-h-0 flex-1 px-2 pb-3">
          <div className="space-y-1 text-[11px] text-[#345a70]">
            {messages
              .filter((m) => m.role === "user")
              .slice(-8)
              .reverse()
              .map((m) => (
                <div key={m.id} className="truncate rounded px-2 py-1 hover:bg-white/60">
                  {m.content}
                </div>
              ))}
            {messages.filter((m) => m.role === "user").length === 0 ? (
              <p className="px-2 py-1 text-[10px] text-slate-500">Nenhum chat iniciado.</p>
            ) : null}
          </div>

          <div className="mt-4 border-t border-[#d4dee6] pt-3">
            <p className="px-2 pb-1 text-[11px] font-semibold text-[#274f67]">
              Arquivos enviados
            </p>
            <div className="space-y-1 text-[11px] text-[#345a70]">
              {documents.slice(0, 10).map((doc) => (
                <div
                  key={doc.id}
                  className="truncate rounded px-2 py-1 hover:bg-white/60"
                  title={doc.name}
                >
                  {doc.name}
                </div>
              ))}
              {documents.length === 0 ? (
                <p className="px-2 py-1 text-[10px] text-slate-500">Sem arquivos no momento.</p>
              ) : null}
            </div>
          </div>
        </ScrollArea>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-6 px-4 pb-6 pt-8">
            {messages.length === 0 ? (
              <div className="mt-[20vh] text-center text-[34px] font-medium text-[#4f6f84]">
                Vinicius Otavio, o que vamos explorar hoje?
              </div>
            ) : null}

            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex flex-col gap-2",
                  m.role === "user" ? "items-end" : "items-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] min-w-0 rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "flex min-h-0 flex-col border border-border bg-card text-card-foreground"
                  )}
                >
                  {m.role === "assistant" ? (
                    m.content ? (
                      <div
                        className={cn(
                          "min-h-0 w-full overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch]",
                          "max-h-[min(72dvh,34rem)] sm:max-h-[min(70dvh,36rem)]"
                        )}
                        tabIndex={0}
                        aria-label="Resposta do assistente (rolagem se for longa)"
                      >
                        <AssistantMarkdown content={m.content} />
                      </div>
                    ) : sending ? (
                      <span className="inline-flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Pensando…
                      </span>
                    ) : null
                  ) : (
                    m.content
                  )}
                </div>
                {m.role === "assistant" && (m.reasoning || m.sources?.length) ? (
                  <div className="flex w-full max-w-[85%] flex-col gap-2 mb-2">
                    {m.reasoning ? (
                      <CollapsibleBlock
                        title="Como chegamos aqui"
                        icon={BrainCircuit}
                        defaultOpen={false}
                      >
                        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {m.reasoning.scopeLabel} · modelo {m.reasoning.model}
                        </p>
                        <ol className="list-decimal space-y-2 pl-4 text-xs leading-relaxed text-muted-foreground">
                          {m.reasoning.steps.map((step, i) => (
                            <li key={i} className="text-card-foreground">
                              {step}
                            </li>
                          ))}
                        </ol>
                      </CollapsibleBlock>
                    ) : null}
                    <CollapsibleBlock
                      title={`Trechos usados como fonte${m.sources?.length ? ` (${m.sources.length})` : ""}`}
                      icon={FileText}
                      defaultOpen={false}
                    >
                      {!m.sources?.length ? (
                        <p className="text-xs text-muted-foreground">
                          Nenhum trecho foi recuperado desta vez; a resposta veio sem contexto dos
                          documentos.
                        </p>
                      ) : (
                        <ul className="space-y-4">
                          {m.sources.map((s, i) => {
                            const rank = i + 1;
                            const proxVec =
                              (Math.min(1, Math.max(0, s.similarity)) * 100).toFixed(1);
                            const rs = s.rerankScore;
                            const hasRerank = rs !== undefined;
                            const proxRerank = hasRerank
                              ? (Math.min(1, Math.max(0, rs)) * 100).toFixed(1)
                              : null;
                            const barPct = hasRerank
                              ? Math.min(100, Math.max(0, rs * 100))
                              : Math.min(100, Math.max(0, s.similarity * 100));
                            const rankLabel = hasRerank
                              ? rank === 1
                                ? "Melhor correspondência após Cohere Rerank"
                                : `${rank}º trecho após Cohere Rerank`
                              : rank === 1
                                ? "Melhor correspondência na busca vetorial"
                                : `${rank}º trecho na busca (ordem de relevância)`;
                            return (
                              <li key={s.id} className="flex gap-3 text-xs">
                                <div
                                  className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-sm font-bold tabular-nums text-primary"
                                  title={rankLabel}
                                  aria-hidden
                                >
                                  {rank}
                                </div>
                                <div className="min-w-0 flex-1 space-y-2">
                                  <div>
                                    <p className="font-medium text-foreground">{rankLabel}</p>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                                      {s.documentName} · trecho original nº {s.chunkIndex + 1}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    {hasRerank ? (
                                      <Badge variant="secondary" className="font-normal">
                                        Cohere Rerank: {proxRerank}%
                                      </Badge>
                                    ) : null}
                                    <Badge
                                      variant={hasRerank ? "outline" : "secondary"}
                                      className="font-normal"
                                    >
                                      Busca vetorial: {proxVec}%
                                    </Badge>
                                    <span
                                      className="text-[10px] leading-tight text-muted-foreground"
                                      title="Scores não são confiança da resposta do modelo; rerank reordena candidatos já recuperados do banco."
                                    >
                                      (métricas de retrieval)
                                    </span>
                                  </div>
                                  <div
                                    className="h-1 overflow-hidden rounded-full bg-muted"
                                    title={
                                      hasRerank
                                        ? `Cohere Rerank ${proxRerank}%`
                                        : `Vetor ${proxVec}%`
                                    }
                                  >
                                    <div
                                      className="h-full rounded-full bg-primary/80 transition-[width] duration-300"
                                      style={{
                                        width: `${barPct}%`,
                                      }}
                                    />
                                  </div>
                                  <p className="text-[12px] leading-relaxed text-muted-foreground">
                                    {s.preview}
                                    {s.preview.length >= 200 ? "…" : ""}
                                  </p>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </CollapsibleBlock>
                  </div>
                ) : null}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="border-t border-[#cad6df] bg-[#eef3f7] p-4">
          <div className="mx-auto flex w-full max-w-2xl gap-2 rounded-2xl border border-[#9eb3c2] bg-[#edf3f7] p-2 shadow-sm">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Como posso lhe ajudar hoje?"
              className="min-h-[44px] resize-none border-0 bg-transparent shadow-none"
              rows={2}
              disabled={sending}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
            />
            <Button
              size="icon"
              className="mt-auto size-8 shrink-0 rounded-full"
              onClick={() => void sendMessage()}
              disabled={sending || !input.trim()}
              aria-label="Send"
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <SendHorizontal className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
