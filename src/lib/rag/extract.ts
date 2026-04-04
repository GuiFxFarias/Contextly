import { PDFParse } from "pdf-parse";

export type ExtractedDocument = {
  text: string;
  pageCount: number | null;
};

export async function extractTextFromBuffer(
  buffer: Buffer,
  fileName: string,
  mime: string
): Promise<ExtractedDocument> {
  const lower = fileName.toLowerCase();
  const isPdf = mime === "application/pdf" || lower.endsWith(".pdf");

  if (isPdf) {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return {
        text: result.text ?? "",
        pageCount: typeof result.total === "number" ? result.total : null,
      };
    } finally {
      await parser.destroy();
    }
  }

  if (
    mime === "text/plain" ||
    lower.endsWith(".txt") ||
    mime === "text/markdown"
  ) {
    return {
      text: buffer.toString("utf8"),
      pageCount: null,
    };
  }

  throw new Error("Unsupported file type. Upload a PDF or TXT file.");
}
