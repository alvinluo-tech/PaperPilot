"use client";

import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useDocument } from '../../context/DocumentContext';
import { apiClient } from '@/lib/api';

export function MainEditor() {
  const { documentId, paragraphs, setDocumentId, setParagraphs, activeParagraphId, setActiveParagraphId, setDiagnosisData, setPlanData, setCandidatesData, setValidationData } = useDocument();
  const [isIngesting, setIsIngesting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [draftText, setDraftText] = useState("");

  // Re-build editor content when paragraphs change
  const htmlContent = paragraphs.map(p => 
    `<p data-id="${p.id}" class="${p.id === activeParagraphId ? 'bg-blue-50 ring-2 ring-blue-300 text-gray-900 font-medium' : 'hover:bg-gray-50 text-gray-800'} rounded px-2 py-1 cursor-pointer transition-colors duration-150">${p.current_text}</p>`
  ).join('');

  const editor = useEditor({
    extensions: [StarterKit],
    content: htmlContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none focus:outline-none min-h-[500px] p-8 bg-white border border-gray-200 rounded-lg shadow-sm text-gray-800 font-serif leading-relaxed text-base',
      },
      handleClick(view, pos, event) {
        const target = event.target as HTMLElement;
        const pElement = target.closest('p[data-id]');
        if (pElement) {
          const id = pElement.getAttribute('data-id');
          if (id) {
            setActiveParagraphId(id);
            // Reset right panel data when switching paragraphs
            setDiagnosisData(null);
            setPlanData(null);
            setCandidatesData(null);
            setValidationData(null);
          }
        }
        return false;
      },
    },
  });

  useEffect(() => {
    // Only update content if we have an editor and it's not currently focused/being edited manually to avoid jumping
    if (editor && htmlContent && !editor.isFocused && documentId) {
      // Small delay to ensure hydration matches
      setTimeout(() => {
        editor.commands.setContent(htmlContent);
      }, 0);
    }
  }, [htmlContent, editor, documentId]);

  const handleIngestCustomText = async () => {
    if (!draftText.trim()) {
      alert("Please enter some text first.");
      return;
    }
    setIsIngesting(true);
    try {
      const res = await apiClient.ingestDocument("My Draft", draftText);
      setDocumentId(res.document.id);
      setParagraphs(res.paragraphs);
    } catch (err) {
      console.error(err);
      alert("Failed to ingest document");
    } finally {
      setIsIngesting(false);
    }
  };

  const handleAnalyze = async () => {
    if (!activeParagraphId) {
      alert("Please select a paragraph to analyze first.");
      return;
    }
    setIsAnalyzing(true);
    try {
      // 1. Diagnose
      const diagRes = await apiClient.diagnoseParagraph(activeParagraphId);
      setDiagnosisData(diagRes.diagnosis);

      // 2. Plan
      const planRes = await apiClient.planEnhancement(activeParagraphId);
      setPlanData(planRes.revisionPlan);

      // 3. Rewrite
      const rewriteRes = await apiClient.rewriteParagraph(activeParagraphId);
      setCandidatesData(rewriteRes.candidates);
      
    } catch (err) {
      console.error(err);
      alert("Failed during analysis pipeline. See console.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden">
      <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center shrink-0 shadow-sm z-10">
        <h1 className="text-xl font-bold text-gray-800">
          Document Editor
        </h1>
        <div className="flex space-x-2">
          {!documentId && (
            <button 
              onClick={handleIngestCustomText}
              disabled={isIngesting || !draftText.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {isIngesting ? "Ingesting..." : "Save & Analyze Draft"}
            </button>
          )}
          {documentId && (
            <button 
              onClick={handleAnalyze}
              disabled={!activeParagraphId || isAnalyzing}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isAnalyzing ? "Analyzing..." : "Analyze Selected"}
            </button>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-8 relative">
        <div className="max-w-4xl mx-auto h-full">
          {!documentId ? (
            <div className="h-full flex flex-col">
              <label htmlFor="draft-input" className="block text-sm font-medium text-gray-700 mb-2">
                Paste your academic draft here to begin:
              </label>
              <textarea
                id="draft-input"
                className="flex-1 w-full p-6 bg-white border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-gray-800 text-base leading-relaxed placeholder-gray-400 font-serif"
                placeholder="Artificial Intelligence (AI) has significantly transformed the landscape of academic writing.&#10;&#10;With the advent of Large Language Models (LLMs), researchers can generate drafts at an unprecedented speed. However, this introduces concerns regarding the authenticity, authorship, and traceability of academic texts..."
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
              />
            </div>
          ) : (
            <EditorContent editor={editor} className="h-full" />
          )}
        </div>
      </div>
    </div>
  );
}