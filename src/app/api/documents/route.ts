import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("documents")
      .select("id, name, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ documents: data ?? [] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to list documents" }, { status: 500 });
  }
}
