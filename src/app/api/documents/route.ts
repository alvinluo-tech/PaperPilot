import { NextResponse } from "next/server";
import { createClient } from "@/infrastructure/database/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, raw_text, language = "en", discipline = "general" } = body;

    if (!raw_text) {
      return NextResponse.json({ error: "raw_text is required" }, { status: 400 });
    }

    // 1. Create Document in DB
    const { data: document, error: docError } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        title: title || "Untitled Document",
        raw_text,
        language,
        discipline,
      })
      .select()
      .single();

    if (docError) {
      throw new Error(`Failed to create document: ${docError.message}`);
    }

    // 2. Simple Rule-based Paragraph Segmentation (as per PRD MVP recommendation)
    // Split by double newlines or similar paragraph breaks
    const paragraphTexts = raw_text
      .split(/\n\s*\n/)
      .map((text: string) => text.trim())
      .filter((text: string) => text.length > 0);

    const paragraphsData = paragraphTexts.map((text: string, index: number) => ({
      document_id: document.id,
      order_index: index,
      raw_text: text,
      current_text: text,
      section_type: "unknown",
    }));

    let paragraphs = [];
    if (paragraphsData.length > 0) {
      const { data: insertedParagraphs, error: paragraphsError } = await supabase
        .from("paragraphs")
        .insert(paragraphsData)
        .select();

      if (paragraphsError) {
        throw new Error(`Failed to create paragraphs: ${paragraphsError.message}`);
      }
      paragraphs = insertedParagraphs;
    }

    return NextResponse.json({
      document,
      paragraphs,
    });
  } catch (error: any) {
    console.error("[POST /api/documents] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
