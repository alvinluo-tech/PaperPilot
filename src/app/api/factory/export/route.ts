import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/database/supabase/server';
import * as XLSX from 'xlsx';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'sharegpt'; // 'sharegpt', 'alpaca', 'csv', 'xlsx', 'txt'
    const domainFilter = searchParams.get('domain') || 'all';

    // Fetch all evaluations that are gold standards, joining with rewrites and segments
    let query = supabase
      .from('factory_evaluations')
      .select(`
        id,
        score_llm_judge,
        score_semantic,
        score_risk,
        factory_rewrites!inner (
          output_text,
          prompt_config,
          factory_segments!inner (
            original_content,
            factory_projects!inner (
              domain
            )
          )
        )
      `)
      .eq('is_gold_standard', true);

    if (domainFilter !== 'all') {
      // Note: Because it's an inner join, we can filter on the nested table
      query = query.eq('factory_rewrites.factory_segments.factory_projects.domain', domainFilter);
    }

    const { data: evaluations, error } = await query;

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
    let txtContent = '';
    const excelData: any[] = [];

    evaluations.forEach((evalItem: any) => {
      const rewrite = evalItem.factory_rewrites;
      const segment = rewrite?.factory_segments;
      if (!rewrite || !segment) return;

      const original = segment?.original_content;
      const rewritten = rewrite?.output_text;
      const domain = segment?.factory_projects?.domain || 'General';
      
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
      } else if (format === 'txt') {
        txtContent += `=========================================\n`;
        txtContent += `[Domain]: ${domain}\n`;
        txtContent += `---------------- ORIGINAL ----------------\n`;
        txtContent += `${original}\n\n`;
        txtContent += `---------------- REWRITTEN ---------------\n`;
        txtContent += `${rewritten}\n`;
        txtContent += `=========================================\n\n`;
      } else if (format === 'csv' || format === 'xlsx') {
        excelData.push({
          Domain: domain,
          'System Prompt': systemPrompt,
          'Original Text': original,
          'Rewritten Text': rewritten,
          'LLM Score': evalItem.score_llm_judge,
          'Semantic Sim': evalItem.score_semantic,
          'AI Risk': evalItem.score_risk
        });
      }
    });

    if (format === 'txt') {
      return new NextResponse(txtContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="paperpilot_gold_standard.txt"`,
        },
      });
    } else if (format === 'csv' || format === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Gold Standards");
      
      const isCsv = format === 'csv';
      const fileBuffer = XLSX.write(workbook, { bookType: isCsv ? 'csv' : 'xlsx', type: 'buffer' });
      
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': isCsv ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="paperpilot_gold_standard.${format}"`,
        },
      });
    }

    // Default for JSONL formats (ShareGPT / Alpaca)
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
