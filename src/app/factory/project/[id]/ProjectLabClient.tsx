"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { createClient } from '@/infrastructure/database/supabase/client';
import { ArrowLeft, RefreshCw, Star, CheckCircle, ThumbsUp, ThumbsDown, Zap } from 'lucide-react';
import Link from 'next/link';
import { rewriteSegmentAction, evaluateRewriteAction } from '@/app/actions/factory';

export default function ProjectLabClient({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<any>(null);
  const [segments, setSegments] = useState<any[]>([]);
  const [activeSegment, setActiveSegment] = useState<any>(null);
  
  // States for the active segment's rewrite
  const [rewrite, setRewrite] = useState<any>(null);
  const [evaluation, setEvaluation] = useState<any>(null);
  
  const [isRewriting, startRewriteTransition] = useTransition();
  const [isEvaluating, startEvaluateTransition] = useTransition();
  const [editedRewriteText, setEditedRewriteText] = useState("");
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const supabase = createClient();

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
    }
  }, [projectId]);

  const fetchProjectData = async () => {
    const { data: projData } = await supabase
      .from('factory_projects')
      .select('*')
      .eq('id', projectId)
      .single();
    
    if (projData) setProject(projData);

    const { data: segData } = await supabase
      .from('factory_segments')
      .select('*, factory_rewrites(*, factory_evaluations(*))')
      .eq('project_id', projectId)
      .order('order_index', { ascending: true });
    
    if (segData) {
      setSegments(segData);
      if (segData.length > 0 && !activeSegment) {
        handleSelectSegment(segData[0]);
      }
    }
  };

  const handleSelectSegment = (seg: any) => {
    if (isRewriting || isEvaluating) return; // Prevent switching while processing
    setActiveSegment(seg);
    const latestRewrite = seg.factory_rewrites?.[seg.factory_rewrites.length - 1];
    setRewrite(latestRewrite || null);
    setEditedRewriteText(latestRewrite?.output_text || "");
    
    const latestEval = latestRewrite?.factory_evaluations?.[latestRewrite.factory_evaluations.length - 1];
    setEvaluation(latestEval || null);
  };

  const handleRewrite = () => {
    if (!activeSegment) return;
    startRewriteTransition(async () => {
      try {
        const result = await rewriteSegmentAction(activeSegment.id);
        if (result.error) {
          showToast(result.error, 'error');
        } else if (result.rewrite) {
          await fetchProjectData(); // Background refresh
          setRewrite(result.rewrite);
          setEditedRewriteText(result.rewrite.output_text);
          setEvaluation(null); // Clear previous evaluation for the new rewrite
          showToast('Rewrite generated successfully!', 'success');
          
          if (result.mathMetricsLog) {
            console.log("--- FROM SERVER ACTION ---");
            console.log(result.mathMetricsLog);
          }
        }
      } catch (err) {
        showToast('An error occurred during rewrite', 'error');
      }
    });
  };

  const handleEvaluate = () => {
    if (!rewrite) return;
    startEvaluateTransition(async () => {
      try {
        const result = await evaluateRewriteAction(rewrite.id, activeSegment.original_content, rewrite.output_text);
        if (result.error) {
          showToast(result.error, 'error');
        } else if (result.evaluation) {
          await fetchProjectData(); // Background refresh
          setEvaluation(result.evaluation); // Update state directly to bypass refresh delay
          showToast('Evaluation completed!', 'success');
        }
      } catch (err) {
        showToast('An error occurred during evaluation', 'error');
      }
    });
  };

  const toggleGoldStandard = async () => {
    if (!evaluation) return;
    const newStatus = !evaluation.is_gold_standard;
    await supabase
      .from('factory_evaluations')
      .update({ is_gold_standard: newStatus })
      .eq('id', evaluation.id);
    
    setEvaluation({ ...evaluation, is_gold_standard: newStatus });
    fetchProjectData(); // Refresh sidebar star indicator
  };

  if (!project) return <div className="p-8 text-gray-500">Loading workspace...</div>;

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans overflow-hidden relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded shadow-lg font-medium text-sm transition-all duration-300 ${toast.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-900 text-white p-4 shadow-sm flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/factory" className="text-gray-400 hover:text-white transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-semibold text-lg">{project.name}</h1>
          <span className="bg-slate-800 text-xs px-2 py-1 rounded">{project.domain}</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Segment List */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
          <div className="p-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase">
            Segments ({segments.length})
          </div>
          {segments.map((seg, idx) => (
            <div 
              key={seg.id}
              onClick={() => handleSelectSegment(seg)}
              className={`p-3 border-b border-gray-100 cursor-pointer transition ${activeSegment?.id === seg.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-gray-700 text-sm">Segment {idx + 1}</span>
                {seg.factory_rewrites?.some((r:any) => r.factory_evaluations?.some((e:any) => e.is_gold_standard)) && (
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                )}
              </div>
              <p className="text-xs text-gray-700 truncate">{seg.original_content}</p>
            </div>
          ))}
        </div>

        {/* Main Content: Side-by-Side Lab */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-gray-100 p-4 gap-4">
          
          {/* Left: Original Text */}
          <div className="flex-1 flex flex-col bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <h2 className="font-semibold text-gray-700">Original AI Text</h2>
              <span className="text-xs text-gray-500">{activeSegment?.word_count || 0} words</span>
            </div>
            <div 
              key={activeSegment?.id} 
              className="p-6 overflow-y-auto flex-1 text-gray-900 font-medium text-sm leading-relaxed whitespace-pre-wrap"
            >
              {activeSegment?.original_content}
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <button 
                onClick={handleRewrite}
                disabled={!activeSegment || isRewriting}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {isRewriting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {isRewriting ? 'Generating Rewrite...' : 'Run Pipeline Rewrite'}
              </button>
            </div>
          </div>

          {/* Right: Rewritten Text & Eval */}
          <div className="flex-1 flex flex-col bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-3 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
              <h2 className="font-semibold text-blue-900">Pipeline Rewrite</h2>
              {rewrite && <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded">{rewrite.model_version}</span>}
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-2 relative">
              {isRewriting && (
                <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center z-10 animate-pulse">
                  <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                  <p className="text-base text-indigo-800 font-semibold">Synthesizing variations...</p>
                  <p className="text-xs text-indigo-500 mt-2 font-medium">Applying voice seeds and imperfections to bypass AI detection</p>
                </div>
              )}
              {!rewrite ? (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                  No rewrite attempts yet.
                </div>
              ) : (
                <>
                  <textarea 
                    key={rewrite.id}
                    value={editedRewriteText}
                    onChange={(e) => setEditedRewriteText(e.target.value)}
                    data-gramm="false"
                    spellCheck="false"
                    className="w-full flex-1 resize-none outline-none text-gray-900 font-medium text-sm leading-relaxed p-2 border border-transparent hover:border-gray-200 focus:border-blue-400 rounded transition"
                  />
                  {editedRewriteText !== rewrite.output_text && (
                    <button 
                      onClick={async () => {
                        await supabase.from('factory_rewrites').update({ output_text: editedRewriteText }).eq('id', rewrite.id);
                        setRewrite({ ...rewrite, output_text: editedRewriteText });
                        fetchProjectData();
                      }}
                      className="self-end px-3 py-1.5 bg-blue-100 text-blue-700 text-xs font-medium rounded hover:bg-blue-200 transition"
                    >
                      Save Manual Edits
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Evaluation Panel */}
            {rewrite && (
              <div className="bg-slate-50 border-t border-gray-200 p-4 relative min-h-[140px] flex flex-col justify-center">
                {isEvaluating ? (
                  <div className="flex flex-col items-center justify-center animate-pulse">
                    <div className="flex space-x-2 mb-4">
                      <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">LLM Expert is reviewing...</p>
                    <p className="text-xs text-slate-500 mt-1">Analyzing semantics, syntax diversity, and AI risks</p>
                  </div>
                ) : !evaluation ? (
                   <button 
                    onClick={handleEvaluate}
                    disabled={isEvaluating}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-md font-medium text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Run LLM Expert Evaluation
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex gap-4 text-sm">
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500 uppercase">LLM Score</span>
                          <span className={`font-bold text-lg ${evaluation.score_llm_judge >= 8 ? 'text-green-600' : 'text-orange-500'}`}>
                            {evaluation.score_llm_judge}/10
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500 uppercase">Semantic Sim</span>
                          <span className="font-bold text-lg text-blue-600">
                            {evaluation.score_semantic ? (evaluation.score_semantic * 100).toFixed(0) + '%' : 'N/A'}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500 uppercase">AI Risk</span>
                          <span className={`font-bold text-lg ${evaluation.score_risk > 0.5 ? 'text-red-500' : 'text-green-600'}`}>
                            {evaluation.score_risk ? (evaluation.score_risk * 100).toFixed(0) + '%' : 'N/A'}
                          </span>
                        </div>
                      </div>
                      
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={async () => {
                          const newValue = evaluation.human_vote === true ? null : true;
                          await supabase.from('factory_evaluations').update({ human_vote: newValue }).eq('id', evaluation.id);
                          setEvaluation({ ...evaluation, human_vote: newValue });
                          showToast(newValue === true ? 'Feedback recorded: Thumbs Up' : 'Feedback removed', 'success');
                        }}
                        className={`p-1.5 rounded transition ${evaluation.human_vote === true ? 'bg-green-100 text-green-600' : 'text-gray-500 hover:bg-gray-200 hover:text-green-600'}`}
                      >
                        <ThumbsUp className={`w-4 h-4 ${evaluation.human_vote === true ? 'fill-green-600' : ''}`} />
                      </button>
                      <button 
                        onClick={async () => {
                          const newValue = evaluation.human_vote === false ? null : false;
                          await supabase.from('factory_evaluations').update({ human_vote: newValue }).eq('id', evaluation.id);
                          setEvaluation({ ...evaluation, human_vote: newValue });
                          showToast(newValue === false ? 'Feedback recorded: Thumbs Down' : 'Feedback removed', 'success');
                        }}
                        className={`p-1.5 rounded transition ${evaluation.human_vote === false ? 'bg-red-100 text-red-600' : 'text-gray-500 hover:bg-gray-200 hover:text-red-600'}`}
                      >
                        <ThumbsDown className={`w-4 h-4 ${evaluation.human_vote === false ? 'fill-red-600' : ''}`} />
                      </button>
                      <button 
                        onClick={toggleGoldStandard}
                        className={`ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${evaluation.is_gold_standard ? 'bg-yellow-100 text-yellow-700 border border-yellow-300' : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'}`}
                      >
                        <Star className={`w-4 h-4 ${evaluation.is_gold_standard ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                        {evaluation.is_gold_standard ? 'Gold Standard' : 'Mark as Gold'}
                      </button>
                    </div>
                    </div>
                    
                    <div className="bg-white p-3 rounded border border-gray-200 text-xs text-gray-600 italic">
                      <span className="font-semibold text-gray-800 not-italic block mb-1">Judge Rationale:</span>
                      {evaluation.llm_judge_reason}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
