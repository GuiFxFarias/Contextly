import OpenAI from "openai";

const MODEL = "text-embedding-3-small";

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  return new OpenAI({ apiKey });
}

const BATCH = 64;

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const openai = getClient();
  const out: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const res = await openai.embeddings.create({
      model: MODEL,
      input: batch,
    });
    const vectors = res.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding as number[]);
    out.push(...vectors);
  }

  return out;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  return v;
}
