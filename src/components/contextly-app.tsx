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
  MessageSquare,
  PanelLeft,
  SendHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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

function formatDocDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function ContextlyApp() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [queryScope, setQueryScope] = useState<QueryScope>({ kind: "all" });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
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

  const toggleScope = (id: string) => {
    const allIds = documents.map((d) => d.id);
    setQueryScope((prev) => {
      if (prev.kind === "all") {
        const ids = allIds.filter((x) => x !== id);
        return { kind: "subset", ids };
      }
      const set = new Set(prev.ids);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      const ids = Array.from(set);
      if (ids.length === 0) return { kind: "subset", ids: [] };
      if (ids.length === allIds.length) return { kind: "all" };
      return { kind: "subset", ids };
    });
  };

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

  const deleteDocument = async (id: string) => {
    if (!confirm("Remove this document and all its chunks from your knowledge base?")) return;
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Delete failed");
      }
      setQueryScope((prev) => {
        if (prev.kind === "all") return prev;
        const ids = prev.ids.filter((x) => x !== id);
        if (ids.length === 0) return { kind: "all" };
        return { kind: "subset", ids };
      });
      await loadDocuments();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Delete failed");
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

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Sparkles className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">Contextly</p>
          <p className="truncate text-xs text-muted-foreground">Your documents, grounded answers</p>
        </div>
      </div>
      <Separator />
      <div className="p-3">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,text/plain,application/pdf"
          className="hidden"
          onChange={onFileSelected}
        />
        <Button
          className="w-full gap-2"
          onClick={onUploadClick}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileUp className="size-4" />
          )}
          Enviar PDF ou TXT
        </Button>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          Você pode selecionar vários arquivos de uma vez. Documentos marcados definem o escopo da busca;
          com todos marcados, a busca usa a biblioteca inteira.
        </p>
      </div>
      <Separator />
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Library
        </span>
        {loadingDocs ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        ) : null}
      </div>
      <ScrollArea className="min-h-0 flex-1 px-2">
        <ul className="space-y-1 pb-4">
          {documents.length === 0 && !loadingDocs ? (
            <li className="px-2 py-8 text-center text-sm text-muted-foreground">
              No documents yet. Upload a file to get started.
            </li>
          ) : null}
          {documents.map((d) => {
            const checked =
              queryScope.kind === "all" || queryScope.ids.includes(d.id);
            return (
              <li
                key={d.id}
                className="group flex items-start gap-2 rounded-lg px-2 py-2 hover:bg-sidebar-accent"
              >
                <label className="mt-0.5 flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleScope(d.id)}
                    className="rounded border-input"
                  />
                </label>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={d.name}>
                    {d.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDocDate(d.created_at)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 opacity-60 hover:opacity-100"
                  onClick={() => void deleteDocument(d.id)}
                  aria-label={`Delete ${d.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </div>
  );

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
      <aside className="hidden w-[280px] shrink-0 md:flex md:flex-col">{sidebar}</aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border px-3 py-3 md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button variant="outline" size="icon" aria-label="Open sidebar" />
              }
            >
              <PanelLeft className="size-4" />
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Documents</SheetTitle>
              </SheetHeader>
              {sidebar}
            </SheetContent>
          </Sheet>
          <MessageSquare className="size-5 text-muted-foreground" />
          <h1 className="text-sm font-semibold">Chat</h1>
        </header>

        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
                <Sparkles className="mx-auto size-10 text-primary" />
                <h2 className="mt-4 text-lg font-semibold tracking-tight">
                  Ask anything in your documents
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Answers use semantic retrieval and stay within your uploaded context. Sources appear
                  below each reply.
                </p>
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
                  <div className="flex w-full max-w-[85%] flex-col gap-2">
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

        <div className="border-t border-border bg-background/80 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto flex max-w-3xl gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about your documents…"
              className="min-h-[52px] resize-none rounded-xl"
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
              className="size-[52px] shrink-0 rounded-xl"
              onClick={() => void sendMessage()}
              disabled={sending || !input.trim()}
              aria-label="Send"
            >
              {sending ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <SendHorizontal className="size-5" />
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
