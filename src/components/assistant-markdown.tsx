"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-4 border-b border-border pb-1 text-base font-semibold tracking-tight text-foreground first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-4 border-b border-border pb-1 text-[15px] font-semibold tracking-tight text-foreground first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 text-sm font-semibold text-foreground first:mt-0">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-[13px] leading-relaxed text-card-foreground [&:not(:first-child)]:mt-3">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1.5 pl-5 text-[13px] text-card-foreground">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1.5 pl-5 text-[13px] text-card-foreground">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed marker:text-muted-foreground">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-card-foreground">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="font-medium text-primary underline underline-offset-2 hover:opacity-90"
      target="_blank"
      rel="noreferrer noopener"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-primary/40 pl-3 text-[13px] italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-border" />,
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg border border-border bg-muted/60 p-3 text-xs leading-relaxed">
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    const block = typeof className === "string" && className.includes("language-");
    if (block) {
      return (
        <code
          className={cn("font-mono text-[12px] text-foreground", className)}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground"
        {...props}
      >
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[240px] border-collapse text-left text-[12px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/50 text-foreground [&_th]:border-border">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border-b border-border px-3 py-2 font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border px-3 py-2 align-top text-card-foreground">{children}</td>
  ),
};

type AssistantMarkdownProps = {
  content: string;
  className?: string;
};

export function AssistantMarkdown({ content, className }: AssistantMarkdownProps) {
  return (
    <div className={cn("assistant-markdown min-w-0", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
