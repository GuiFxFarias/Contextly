-- Contextly — run in Supabase SQL Editor (once per project)
-- Requires: pgvector extension (enabled by default on Supabase)

create extension if not exists vector;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.embeddings (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  content text not null,
  embedding vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb
);

-- App acessa só via API routes com service role; sem políticas públicas necessárias.
alter table public.documents disable row level security;
alter table public.embeddings disable row level security;

create index if not exists embeddings_document_id_idx on public.embeddings (document_id);

-- HNSW index for cosine similarity (good default for Supabase pgvector)
create index if not exists embeddings_embedding_hnsw
  on public.embeddings
  using hnsw (embedding vector_cosine_ops);

-- Similarity search: cosine distance operator <=>
create or replace function public.match_embeddings (
  query_embedding vector(1536),
  match_count int default 5,
  filter_document_ids uuid[] default null
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity double precision
)
language sql
stable
parallel safe
as $$
  select
    e.id,
    e.document_id,
    e.content,
    e.metadata,
    (1 - (e.embedding <=> query_embedding))::double precision as similarity
  from public.embeddings e
  where filter_document_ids is null
     or e.document_id = any(filter_document_ids)
  order by e.embedding <=> query_embedding
  limit least(match_count, 100);
$$;
