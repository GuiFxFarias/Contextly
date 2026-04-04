import { NextResponse } from "next/server";
import { chunkText } from "@/lib/rag/chunk";
import { embedTexts } from "@/lib/rag/embeddings";
import { extractTextFromBuffer } from "@/lib/rag/extract";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const mime = file.type || "application/octet-stream";

    const { text, pageCount } = await extractTextFromBuffer(
      buffer,
      file.name,
      mime
    );

    if (!text.trim()) {
      return NextResponse.json(
        { error: "No extractable text found in this file." },
        { status: 422 }
      );
    }

    const chunks = chunkText(text, file.name, null);
    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "Could not create text chunks from this file." },
        { status: 422 }
      );
    }

    const vectors = await embedTexts(chunks.map((c) => c.content));
    const supabase = getSupabaseAdmin();

    const { data: docRow, error: docErr } = await supabase
      .from("documents")
      .insert({ name: file.name })
      .select("id")
      .single();

    if (docErr || !docRow) {
      console.error(docErr);
      return NextResponse.json(
        { error: "Failed to save document metadata." },
        { status: 500 }
      );
    }

    const documentId = docRow.id as string;
    const metaBase = {
      fileName: file.name,
      sourceMime: mime,
      pageCount,
    };

    const rows = chunks.map((c, i) => ({
      document_id: documentId,
      content: c.content,
      embedding: vectors[i]!,
      metadata: {
        ...metaBase,
        chunkIndex: c.metadata.chunkIndex,
        page: c.metadata.page,
        tokenCount: c.metadata.tokenCount,
      },
    }));

    const { error: insErr } = await supabase.from("embeddings").insert(rows);
    if (insErr) {
      console.error(insErr);
      await supabase.from("documents").delete().eq("id", documentId);
      return NextResponse.json(
        { error: "Failed to store embeddings. Check Supabase schema and vector dimension (1536)." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      documentId,
      name: file.name,
      chunkCount: chunks.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    console.error(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
