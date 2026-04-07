"use client";

import { useEffect, useRef, useState } from "react";
import {
  Building2,
  ChevronRight,
  CircleHelp,
  Cog,
  FileText,
  Mail,
  Plus,
  RefreshCcw,
  Trash2,
  UserPlus,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ContextlyApp } from "@/components/contextly-app";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [{ label: "Sales" }, { label: "Agentes" }, { label: "Arquivos" }] as const;

type ViewMode =
  | "company"
  | "settings-users"
  | "module-picker"
  | "agents"
  | "chat"
  | "files";

type DocumentRow = {
  id: string;
  name: string;
  created_at: string;
};

const MODULES = [
  { id: "crm", label: "Comercial", items: ["Agentes", "Arquivos"] },
  { id: "people", label: "Pessoas / RH", items: ["Agentes", "Arquivos"] },
  { id: "executive", label: "Executive", items: ["Agentes", "Arquivos"] },
  { id: "finance", label: "Financeiro", items: ["Agentes", "Arquivos"] },
] as const;

export function CompanyInfoScreen() {
  const [activeModule, setActiveModule] = useState<(typeof MODULES)[number]>(MODULES[1]);
  const [activeNav, setActiveNav] = useState<string>(MODULES[1].items[0]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("company");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState("agent-guilherme");
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const agents = [
    { id: "new", name: "Novo Agente", org: "", description: "" },
    {
      id: "agent-guilherme",
      name: "teste Guilherme",
      org: "GRUPOKOMVOS",
      description: "teste",
    },
  ] as const;
  const selectedAgent =
    agents.find((agent) => agent.id === selectedAgentId) ?? agents[0];

  useEffect(() => {
    const onPointerDown = (ev: MouseEvent) => {
      const target = ev.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const loadDocuments = async () => {
    setLoadingDocs(true);
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load documents");
      setDocuments((data.documents ?? []) as DocumentRow[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    void loadDocuments();
  }, []);

  const openModulePicker = () => {
    setViewMode("module-picker");
    setMenuOpen(false);
  };

  const openCompanyInfo = () => {
    setViewMode("company");
    setMenuOpen(false);
  };

  const openUsersSettings = () => {
    setViewMode("settings-users");
    setMenuOpen(false);
  };

  const selectModule = (moduleId: (typeof MODULES)[number]["id"]) => {
    const module = MODULES.find((m) => m.id === moduleId);
    if (!module) return;
    setActiveModule(module);
    setActiveNav(module.items[0]);
    setViewMode("agents");
    setSelectedAgentId("agent-guilherme");
  };

  const onUploadClick = () => fileInputRef.current?.click();

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
          if (!res.ok) throw new Error(data.error ?? "Falha no envio");
        } catch (err) {
          console.error(err);
          const msg = err instanceof Error ? err.message : "Falha no envio";
          errors.push(`${file.name}: ${msg}`);
        }
      }
      await loadDocuments();
      if (errors.length > 0) {
        alert(errors.join("\n"));
      }
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = async (id: string) => {
    if (!confirm("Excluir este arquivo da base de conhecimento?")) return;
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Falha ao excluir");
      }
      await loadDocuments();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Falha ao excluir");
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f2f5f8] text-slate-800 md:flex-row">
      <aside className="relative flex w-full shrink-0 flex-col bg-[#0f4f79] text-white md:h-screen md:w-64">
        <div className="px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-full border border-white/40 bg-white/10">
              <span className="text-lg font-bold tracking-tight">M</span>
            </div>
            <div>
              <p className="text-sm leading-none font-semibold">KOMVOS</p>
              <p className="text-sm leading-none font-semibold">MIND</p>
            </div>
          </div>
        </div>

        <Separator className="bg-white/15" />

        <nav className="space-y-1 px-2 py-3">
          <button
            type="button"
            onClick={openModulePicker}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
              viewMode === "module-picker"
                ? "bg-white/15 text-white"
                : "text-white/85 hover:bg-white/10 hover:text-white"
            )}
          >
            <span className="size-2 rounded-full bg-white/70" />
            {activeModule.label}
          </button>
          {activeModule.items.map((item) => {
            const active = item === activeNav;
            return (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setActiveNav(item);
                  if (item === "Agentes") setViewMode("agents");
                  if (item === "Arquivos") setViewMode("files");
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                  active
                    ? "bg-white/15 text-white"
                    : "text-white/85 hover:bg-white/10 hover:text-white"
                )}
              >
                <span className="size-2 rounded-full bg-white/70" />
                {item}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-white/15 p-3" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/10"
          >
            <div className="grid size-8 place-items-center rounded-full bg-white text-xs font-bold text-[#0f4f79]">
              VO
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">Vinícius Otávio</p>
              <p className="truncate text-[11px] text-white/70">vinicius@statum.co...</p>
            </div>
            <ChevronRight
              className={cn("size-4 text-white/70 transition-transform", menuOpen && "rotate-90")}
            />
          </button>

          {menuOpen ? (
            <div className="absolute right-3 bottom-16 z-30 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl md:left-4 md:right-auto">
              <button
                type="button"
                onClick={openUsersSettings}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <Settings className="size-4 text-slate-500" />
                Configurações
              </button>
              <button
                type="button"
                onClick={openCompanyInfo}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <Building2 className="size-4 text-slate-500" />
                Informações da empresa
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      <main className="min-h-0 min-w-0 flex-1 overflow-hidden p-4 md:p-8">
        <div className="mx-auto flex h-full max-w-5xl min-h-0 flex-col">
          {viewMode === "module-picker" ? (
            <>
              <div className="mb-5">
                <h1 className="text-2xl font-semibold text-[#0f4f79] md:text-4xl">
                  Escolha um módulo
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Selecione o módulo disponível para atualizar o menu lateral.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {MODULES.map((module) => (
                  <button
                    key={module.id}
                    type="button"
                    onClick={() => selectModule(module.id)}
                    className={cn(
                      "rounded-xl border px-4 py-4 text-left transition-colors",
                      module.id === activeModule.id
                        ? "border-[#0f4f79] bg-[#eaf3f8]"
                        : "border-[#c3d3df] bg-white hover:bg-[#f3f8fb]"
                    )}
                  >
                    <p className="text-sm font-semibold text-[#214f69]">{module.label}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {module.items.join(" • ")}
                    </p>
                  </button>
                ))}
              </div>
            </>
          ) : viewMode === "agents" ? (
            <>
              <div className="mb-4">
                <h1 className="text-2xl font-semibold text-[#0f4f79] md:text-4xl">Agentes</h1>
                <p className="mt-2 text-sm text-slate-500">Gerencie e visualize seus agentes</p>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-[#c8d6e0] bg-[#f6f9fc]">
                <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[1fr_1.05fr]">
                  <div className="min-h-0 border-r border-[#d3dfe8] p-3">
                    <div className="mb-3 flex items-stretch gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedAgentId("new")}
                        className={cn(
                          "flex h-20 w-36 flex-col items-center justify-center rounded-lg border text-xs",
                          selectedAgentId === "new"
                            ? "border-[#1d4f6b] bg-white text-[#1d4f6b]"
                            : "border-[#d0dbe4] bg-white text-[#3e6278]"
                        )}
                      >
                        <Plus className="mb-1 size-4" />
                        Novo Agente
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedAgentId("agent-guilherme")}
                        className={cn(
                          "flex h-20 w-36 flex-col items-center justify-center rounded-lg border text-xs",
                          selectedAgentId === "agent-guilherme"
                            ? "border-[#0f172a] bg-white text-[#214d66]"
                            : "border-[#d0dbe4] bg-white text-[#3e6278]"
                        )}
                      >
                        <p className="text-sm font-semibold">teste Guilherme</p>
                        <p className="text-[10px] text-slate-500">GRUPOKOMVOS</p>
                        <p className="mt-0.5 text-[10px] text-[#1d4f6b]">{activeModule.label}</p>
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <button type="button" className="rounded bg-[#b7cddd] px-2 py-0.5 text-white">
                        Anterior
                      </button>
                      <span>Página 1 de 1</span>
                      <button type="button" className="rounded bg-[#9db9cd] px-2 py-0.5 text-white">
                        Próxima
                      </button>
                    </div>
                  </div>

                  <ScrollArea className="min-h-0 p-4">
                    <div className="space-y-4">
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <h2 className="text-lg font-semibold text-[#214d66]">Detalhes do Agente</h2>
                          <Cog className="size-4 text-[#2f5f79]" />
                        </div>
                        <div className="space-y-1 text-sm text-[#3e6278]">
                          <p>
                            <span className="font-medium">Nome:</span>{" "}
                            {selectedAgentId === "new" ? "-" : selectedAgent.name}
                          </p>
                          <p>
                            <span className="font-medium">Organização:</span>{" "}
                            {selectedAgentId === "new" ? "-" : selectedAgent.org}
                          </p>
                          <p>
                            <span className="font-medium">Descrição:</span>{" "}
                            {selectedAgentId === "new" ? "-" : selectedAgent.description}
                          </p>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Button
                            className="h-7 bg-[#1b2b72] px-3 text-xs text-white"
                            onClick={() => setViewMode("chat")}
                          >
                            Ir para Chat
                          </Button>
                          <Button variant="outline" className="h-7 px-3 text-xs">
                            Voltar
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <h3 className="text-base font-semibold text-[#214d66]">Editar Agente</h3>
                        <div>
                          <label className="mb-1 block text-xs text-[#385d73]">Nome do agente</label>
                          <input
                            className="w-full rounded border border-[#d5e0e8] bg-white px-2 py-1.5 text-sm"
                            defaultValue={selectedAgentId === "new" ? "" : selectedAgent.name}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-[#385d73]">Descrição do agente</label>
                          <textarea
                            className="min-h-[72px] w-full rounded border border-[#d5e0e8] bg-white px-2 py-1.5 text-sm"
                            defaultValue={selectedAgentId === "new" ? "" : selectedAgent.description}
                          />
                          <p className="mt-1 text-right text-[11px] text-[#4c7288]">5/250 caracteres</p>
                        </div>
                        <Separator />
                        <div>
                          <p className="mb-2 text-base font-semibold text-[#214d66]">
                            Configurações avançadas de personalidade do agente (opcional)
                          </p>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs text-[#385d73]">
                                Personalidade do agente
                              </label>
                              <select className="w-full rounded border border-[#d5e0e8] bg-white px-2 py-1.5 text-sm text-[#2c546c]">
                                <option>Profissional</option>
                                <option>Amigável</option>
                                <option>Técnico</option>
                                <option>Consultivo</option>
                                <option>Mentor</option>
                                <option>Analítico</option>
                                <option>Persuasivo</option>
                                <option>Criativo</option>
                                <option>Didático</option>
                                <option>Empático</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-[#385d73]">Tipo de resposta</label>
                              <select className="w-full rounded border border-[#d5e0e8] bg-white px-2 py-1.5 text-sm text-[#2c546c]">
                                <option>Detalhada</option>
                                <option>Objetiva</option>
                                <option>Executiva</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-[#385d73]">
                                Referir-se ao usuário como
                              </label>
                              <select className="w-full rounded border border-[#d5e0e8] bg-white px-2 py-1.5 text-sm text-[#2c546c]">
                                <option>Nome Completo</option>
                                <option>Primeiro Nome</option>
                                <option>Você</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-[#385d73]">
                                Usar emojis nas mensagens?
                              </label>
                              <select className="w-full rounded border border-[#d5e0e8] bg-white px-2 py-1.5 text-sm text-[#2c546c]">
                                <option>Não</option>
                                <option>Sim</option>
                              </select>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-[#385d73]">
                            Instruções avançadas de personalidade
                          </label>
                          <textarea
                            className="min-h-[72px] w-full rounded border border-[#d5e0e8] bg-white px-2 py-1.5 text-sm"
                            defaultValue="Me traga insights"
                          />
                          <p className="mt-1 text-right text-[11px] text-[#4c7288]">17/5000 caracteres</p>
                        </div>
                        <Button className="h-8 w-full bg-[#1b2b72] text-xs text-white">
                          Salvar alterações
                        </Button>
                      </div>
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </>
          ) : viewMode === "chat" ? (
            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-[#c8d6e0] bg-[#edf3f7]">
              <ContextlyApp embedded />
            </div>
          ) : viewMode === "files" ? (
            <>
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold text-[#0f4f79] md:text-4xl">Arquivos</h1>
                  <p className="mt-2 text-sm text-slate-500">
                    Faça upload de documentos para alimentar o RAG.
                  </p>
                </div>
                <div>
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
                    className="h-8 bg-[#0f4f79] px-3 text-xs text-white hover:bg-[#0b456b]"
                  >
                    {uploading ? "Enviando..." : "Enviar PDF/TXT"}
                  </Button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-[#c8d6e0] bg-white">
                <ScrollArea className="h-full p-3">
                  <div className="space-y-2">
                    {loadingDocs ? (
                      <p className="text-sm text-slate-500">Carregando arquivos...</p>
                    ) : documents.length === 0 ? (
                      <p className="text-sm text-slate-500">Nenhum arquivo enviado ainda.</p>
                    ) : (
                      documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between rounded-lg border border-[#d7e1e8] bg-[#f7fafc] px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[#234c66]">{doc.name}</p>
                            <p className="text-xs text-slate-500">
                              {new Date(doc.created_at).toLocaleString("pt-BR")}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-slate-500 hover:text-red-600"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void deleteDocument(doc.id);
                            }}
                            aria-label={`Excluir ${doc.name}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </>
          ) : viewMode === "company" ? (
            <>
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold text-[#0f4f79] md:text-4xl">
                    Informações e documentos da empresa
                  </h1>
                  <p className="mt-2 text-sm text-slate-500">
                    Gerencie e visualize as informações de base da organização.
                  </p>
                </div>
              </div>

              <ScrollArea className="min-h-0 flex-1 rounded-xl pr-2">
                <div className="space-y-4 pb-4">
              <Card className="border border-[#2e647f]/35 bg-white/90">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-700">
                    Descrição da organização
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-7 text-slate-600">
                  Komvos é um grupo empresarial brasileiro de tecnologia com atuação nacional,
                  estruturado para integrar software de gestão, serviços especializados,
                  desenvolvimento sob medida e inteligência artificial. O grupo reúne empresas
                  com expertise em ERP, HCM, cloud, dados e automação, oferecendo suporte para
                  empresas de médio e grande porte.
                </CardContent>
              </Card>

              <Card className="border border-[#2e647f]/35 bg-white/90">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-700">Missão</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">
                  Evoluir empresas, construir o futuro.
                </CardContent>
              </Card>

              <Card className="border border-[#2e647f]/35 bg-white/90">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-700">Visão</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">
                  Ser referência em integração de tecnologia, IA aplicada e gestão orientada a
                  dados para organizações em expansão.
                </CardContent>
              </Card>

              <Card className="border border-[#2e647f]/60 bg-[#f6f9fc] shadow-[0_2px_6px_rgba(20,75,102,0.18)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-[#2c5f7a]">Metas</CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-7 text-[#315f77]">
                  Metas do Grupo Komvos: Faturamento 2026: R$ 52.000.000,00 Super meta:
                  R$ 56.000.000,00 Metas Senior Noroeste Paulista: Faturamento:
                  R$ 46.696.560,00 Crescimento anual de 15% EBITDA: 15% Lucro Líquido: 10%
                  Saldo de Caixa: R$ 500.000,00 Metas Statum Faturamento: R$ 5.688.732,70 Lucro
                  Líquido: 5% Crescimento anual de 50% As metas da Trusth estão incluídas na
                  soma do faturamento da Senior Noroeste Paulista.
                </CardContent>
              </Card>

              <Card className="border border-[#2e647f]/60 bg-[#f6f9fc] shadow-[0_2px_6px_rgba(20,75,102,0.18)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-[#2c5f7a]">
                    Número de Colaboradores
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-lg font-medium text-[#315f77]">150</CardContent>
              </Card>

              <Card className="border border-[#2e647f]/60 bg-[#f6f9fc] shadow-[0_2px_6px_rgba(20,75,102,0.18)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-[#2c5f7a]">
                    História da Empresa
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-lg text-[#315f77]">Não informado</CardContent>
              </Card>

              <Card className="border border-[#2e647f]/60 bg-[#f6f9fc] shadow-[0_2px_6px_rgba(20,75,102,0.18)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-[#2c5f7a]">
                    Receita Anual Bruta
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-lg font-medium text-[#315f77]">
                  R$ 44.000.000,00
                </CardContent>
              </Card>

              <Card className="border border-[#2e647f]/60 bg-[#f6f9fc] shadow-[0_2px_6px_rgba(20,75,102,0.18)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-[#2c5f7a]">
                    Área de atuação
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-7 text-[#315f77]">
                  Atua no setor de tecnologia para gestão empresarial, com foco em ERP, HCM,
                  cloud, desenvolvimento de software, inteligência artificial, dados, BPO e
                  educação corporativa, promovendo transformação digital, eficiência operacional e
                  suporte estratégico.
                </CardContent>
              </Card>

              <Card className="border border-[#2e647f]/60 bg-[#f6f9fc] shadow-[0_2px_6px_rgba(20,75,102,0.18)]">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-semibold text-[#2c5f7a]">
                      Documentos da Organização (Compartilhados)
                    </CardTitle>
                    <CircleHelp className="size-4 text-[#2c5f7a]/80" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-[#cad5de] bg-white/75 px-3 py-2">
                    <div className="flex items-start gap-2 border-b border-[#d6e0e7] py-2">
                      <FileText className="mt-0.5 size-4 text-[#2c5f7a]" />
                      <div>
                        <p className="text-sm font-semibold text-[#2e5f77]">
                          MANUAL-COLABORADOR-ESTAGIARIO 2025 atualizado (1).pdf
                        </p>
                        <p className="text-xs text-[#5f7f93]">
                          MANUAL-COLABORADOR-ESTAGIARIO 2025 atualizado (1).pdf
                        </p>
                      </div>
                    </div>
                    <div className="py-2 text-sm font-medium text-[#5f7f93]">TODO</div>
                  </div>
                </CardContent>
              </Card>
                </div>
              </ScrollArea>
            </>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold text-[#0f4f79] md:text-4xl">
                    Configurações
                  </h1>
                  <p className="mt-2 text-sm text-slate-500">Gerencie as configurações do sistema.</p>
                </div>
                <p className="mt-2 text-xs text-emerald-600">Sistema configurado</p>
              </div>

              <div className="mb-3 inline-flex rounded-md border border-[#687c8d] bg-white p-0.5 text-xs">
                <button type="button" className="rounded px-3 py-1 text-[#697e8f]">
                  Banco de Dados
                </button>
                <button
                  type="button"
                  className="rounded bg-[#e9eff4] px-3 py-1 font-semibold text-[#355d75]"
                >
                  Usuários
                </button>
              </div>

              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xl font-semibold text-[#164e6d]">Gerenciamento de Usuários</p>
                  <p className="text-sm text-slate-500">
                    Gerencie usuários, permissões e convites da organização
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="h-8 border-slate-300 bg-white px-2.5 text-xs">
                    <RefreshCcw className="mr-1 size-3.5" />
                    Recarregar
                  </Button>
                  <Button variant="outline" className="h-8 border-slate-300 bg-white px-2.5 text-xs">
                    <Mail className="mr-1 size-3.5" />
                    Convites Pendentes
                  </Button>
                  <Button className="h-8 bg-[#0f4f79] px-2.5 text-xs text-white hover:bg-[#0d476d]">
                    <UserPlus className="mr-1 size-3.5" />
                    Convidar Usuário
                  </Button>
                </div>
              </div>

              <ScrollArea className="min-h-0 flex-1 rounded-xl pr-2">
                <div className="space-y-3 pb-4">
                  <Card className="border border-[#c5d3de] bg-[#f7fafc] py-2">
                    <CardContent className="grid grid-cols-2 gap-2 text-xs text-[#3e6177] md:grid-cols-4">
                      <div>
                        <p className="text-[11px] text-slate-500">Total Permitido</p>
                        <p className="text-2xl font-semibold text-[#2f5f79]">30</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">Usuários Cadastrados</p>
                        <p className="text-2xl font-semibold text-emerald-600">3</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">Vagas Disponíveis</p>
                        <p className="text-2xl font-semibold text-orange-500">27</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">Percentual Ocupado</p>
                        <p className="text-2xl font-semibold text-[#2f5f79]">10%</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border border-[#c5d3de] bg-white/90 py-2">
                    <CardContent>
                      <div className="overflow-x-auto rounded-md border border-[#d4dee6]">
                        <table className="min-w-full text-left text-xs">
                          <thead className="bg-[#e9eef3] text-[#47657b]">
                            <tr>
                              <th className="px-3 py-2 font-semibold">Email</th>
                              <th className="px-3 py-2 font-semibold">Nome</th>
                              <th className="px-3 py-2 font-semibold">Status</th>
                              <th className="px-3 py-2 font-semibold">Assentos</th>
                              <th className="px-3 py-2 font-semibold">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white text-[#385d73]">
                            <tr className="border-t border-[#e4ebf1]">
                              <td className="px-3 py-2">fabiano.ferreira@senior-rp.com.br</td>
                              <td className="px-3 py-2">Fabiano Ferreira</td>
                              <td className="px-3 py-2">
                                <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-700">
                                  Ativo
                                </span>
                              </td>
                              <td className="px-3 py-2">Assento 5</td>
                              <td className="px-3 py-2">Permissão / Deletar</td>
                            </tr>
                            <tr className="border-t border-[#e4ebf1]">
                              <td className="px-3 py-2">user@teste.com</td>
                              <td className="px-3 py-2">user teste</td>
                              <td className="px-3 py-2">
                                <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-700">
                                  Ativo
                                </span>
                              </td>
                              <td className="px-3 py-2">Assento 1</td>
                              <td className="px-3 py-2">Permissão / Deletar</td>
                            </tr>
                            <tr className="border-t border-[#e4ebf1]">
                              <td className="px-3 py-2">vinicius@statum.com.br</td>
                              <td className="px-3 py-2">Vinicius Otávio</td>
                              <td className="px-3 py-2">
                                <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-700">
                                  Ativo
                                </span>
                              </td>
                              <td className="px-3 py-2">Assento 2</td>
                              <td className="px-3 py-2">Permissão / Deletar</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
