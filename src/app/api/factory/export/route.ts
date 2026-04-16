import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/database/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'sharegpt'; // 'sharegpt' or 'alpaca'

    // Fetch all evaluations that are gold standards, joining with rewrites and segments
    const { data: evaluations, error } = await supabase
      .from('factory_evaluations')
      .select(`
        id,
        factory_rewrites (
          output_text,
          prompt_config,
          factory_segments (
            original_content,
            factory_projects (
              domain
            )
          )
        )
      `)
      .eq('is_gold_standard', true);

    if (error) {
      console.error('Export Error:', error);
      return NextResponse.json({ error: 'Failed to fetch gold standards' }, { status: 500 });
    }

    if (!evaluations || evaluations.length === 0) {
      return new NextResponse('', {
        status: 200,
        headers: {
          'Content-Type': 'application/jsonl',
          'Content-Disposition': 'attachment; filename="gold_standard.jsonl"',
        },
      });
    }

    let jsonlContent = '';

    evaluations.forEach((evalItem: any) => {
      const rewrite = evalItem.factory_rewrites;
      const segment = rewrite?.factory_segments;
      if (!rewrite || !segment) return;

      const original = segment.original_content;
      const rewritten = rewrite.output_text;
      
      const systemPrompt = rewrite.prompt_config?.system_prompt || "You are an expert academic editor. Rewrite the text to be more human-like, removing AI patterns.";

      if (format === 'sharegpt') {
        const item = {
          conversations: [
            { from: 'system', value: systemPrompt },
            { from: 'human', value: `Original text:\n\n${original}` },
            { from: 'gpt', value: rewritten }
          ]
        };
        jsonlContent += JSON.stringify(item) + '\n';
      } else if (format === 'alpaca') {
        const item = {
          instruction: systemPrompt,
          input: `Original text:\n\n${original}`,
          output: rewritten
        };
        jsonlContent += JSON.stringify(item) + '\n';
      }
    });

    return new NextResponse(jsonlContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/jsonl',
        'Content-Disposition': `attachment; filename="paperpilot_gold_${format}.jsonl"`,
      },
    });

  } catch (error) {
    console.error('Factory Export Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
