import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/database/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Auth Check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, domain, content } = await request.json();

    if (!name || !content) {
      return NextResponse.json({ error: "Name and content are required" }, { status: 400 });
    }

    // 1. Create Project
    const { data: project, error: projError } = await supabase
      .from('factory_projects')
      .insert({
        name,
        domain: domain || 'General',
        user_id: user.id
      })
      .select()
      .single();

    if (projError) throw new Error(projError.message);

    // 2. Chunking Logic (M1)
    // - Split by double newlines
    // - If a chunk is too short (< 30 words), try to merge with the next one
    const rawParagraphs = content.split(/\n\s*\n/).map((p: string) => p.trim()).filter((p: string) => p.length > 0);
    
    const chunks: string[] = [];
    let currentChunk = "";

    for (const p of rawParagraphs) {
      const pWordCount = p.split(/\s+/).length;
      
      if (currentChunk) {
        const currentWordCount = currentChunk.split(/\s+/).length;
        if (currentWordCount < 50) {
          // Merge if current chunk is too short
          currentChunk += "\n\n" + p;
        } else {
          chunks.push(currentChunk);
          currentChunk = p;
        }
      } else {
        currentChunk = p;
      }
    }
    if (currentChunk) chunks.push(currentChunk);

    // 3. Save Segments
    const segmentsData = chunks.map((text, idx) => ({
      project_id: project.id,
      original_content: text,
      word_count: text.split(/\s+/).length,
      order_index: idx
    }));

    const { data: segments, error: segError } = await supabase
      .from('factory_segments')
      .insert(segmentsData)
      .select();

    if (segError) throw new Error(segError.message);

    return NextResponse.json({ project, segmentsCount: segments.length });

  } catch (error: any) {
    console.error("[Factory Ingest API Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}