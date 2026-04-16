"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@/infrastructure/database/supabase/client';
import { Database, FileText, Upload, Plus, Download, BarChart2, List, X } from 'lucide-react';
import Link from 'next/link';

export default function FactoryDashboard() {
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  // New project state
  const [projectName, setProjectName] = useState("");
  const [domain, setDomain] = useState("CS");
  const [textContent, setTextContent] = useState("");
  const [isIngesting, setIsIngesting] = useState(false);

  // Stats state
  const [showStats, setShowStats] = useState(false);
  const [statsData, setStatsData] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('factory_projects')
      .select('*, factory_segments(count)')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setProjects(data);
    }
    setIsLoading(false);
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName || !textContent) return;
    setIsIngesting(true);
    
    try {
      const res = await fetch('/api/factory/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName, domain, content: textContent })
      });
      
      if (!res.ok) throw new Error("Failed to ingest");
      
      setProjectName("");
      setTextContent("");
      fetchProjects(); // Refresh list
    } catch (err) {
      console.error(err);
      alert("Error creating project");
    } finally {
      setIsIngesting(false);
    }
  };

  const fetchStats = async () => {
    setShowStats(true);
    setIsLoadingStats(true);
    try {
      const { data: evals, error } = await supabase
        .from('factory_evaluations')
        .select('*');
        
      if (error) throw error;
      
      const totalEvaluations = evals.length;
      const goldStandards = evals.filter(e => e.is_gold_standard);
      const totalGold = goldStandards.length;
      
      const avgScore = totalGold > 0 ? (goldStandards.reduce((acc, curr) => acc + (curr.score_llm_judge || 0), 0) / totalGold).toFixed(1) : 0;
      const avgSemantic = totalGold > 0 ? ((goldStandards.reduce((acc, curr) => acc + (curr.score_semantic || 0), 0) / totalGold) * 100).toFixed(0) : 0;
      const avgRisk = totalGold > 0 ? ((goldStandards.reduce((acc, curr) => acc + (curr.score_risk || 0), 0) / totalGold) * 100).toFixed(0) : 0;

      setStatsData({
        totalEvaluations,
        totalGold,
        avgScore,
        avgSemantic,
        avgRisk
      });
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-slate-900 text-white p-4 shadow-md flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Database className="w-6 h-6 text-blue-400" />
          <h1 className="text-xl font-bold tracking-tight">PaperPilot Data Factory</h1>
          <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-0.5 rounded border border-blue-500/30 ml-2">AIGC LoRA Lab</span>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={fetchStats}
            className="flex items-center gap-1.5 text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded transition"
          >
            <BarChart2 className="w-4 h-4" /> 
            <span>Stats</span>
          </button>
          
          {/* Export Dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 text-sm bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded transition text-white">
              <Download className="w-4 h-4" /> Export Gold Standard
            </button>
            <div className="absolute hidden group-hover:flex flex-col top-full right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden z-50 w-56">
              <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                For LLM Fine-tuning
              </div>
              <a href="/api/factory/export?format=sharegpt" download className="px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 transition flex justify-between items-center">
                ShareGPT Format <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">.jsonl</span>
              </a>
              <div className="h-px bg-gray-100"></div>
              <a href="/api/factory/export?format=alpaca" download className="px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 transition flex justify-between items-center">
                Alpaca Format <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">.jsonl</span>
              </a>
              
              <div className="px-3 py-1.5 bg-gray-50 border-y border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider mt-1">
                For Human Review
              </div>
              <a href="/api/factory/export?format=xlsx" download className="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition flex justify-between items-center">
                Excel Spreadsheet <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">.xlsx</span>
              </a>
              <div className="h-px bg-gray-100"></div>
              <a href="/api/factory/export?format=csv" download className="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition flex justify-between items-center">
                CSV Data <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">.csv</span>
              </a>
              <div className="h-px bg-gray-100"></div>
              <a href="/api/factory/export?format=txt" download className="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition flex justify-between items-center">
                Plain Text <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">.txt</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
        
        {/* Stats Modal */}
        {showStats && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-blue-500" />
                  Data Factory Statistics
                </h2>
                <button onClick={() => setShowStats(false)} className="text-gray-400 hover:text-gray-600 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6">
                {isLoadingStats ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : statsData ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                      <div className="text-xs text-blue-600 font-semibold uppercase tracking-wider mb-1">Total Gold Standards</div>
                      <div className="text-3xl font-bold text-blue-900">{statsData.totalGold}</div>
                      <div className="text-xs text-blue-500 mt-1">out of {statsData.totalEvaluations} evaluations</div>
                    </div>
                    
                    <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                      <div className="text-xs text-green-600 font-semibold uppercase tracking-wider mb-1">Avg LLM Score</div>
                      <div className="text-3xl font-bold text-green-900">{statsData.avgScore} <span className="text-sm font-normal text-green-700">/ 10</span></div>
                      <div className="text-xs text-green-500 mt-1">across all gold standards</div>
                    </div>
                    
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                      <div className="text-xs text-purple-600 font-semibold uppercase tracking-wider mb-1">Avg Semantic Sim</div>
                      <div className="text-3xl font-bold text-purple-900">{statsData.avgSemantic}%</div>
                      <div className="text-xs text-purple-500 mt-1">meaning retention</div>
                    </div>
                    
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                      <div className="text-xs text-orange-600 font-semibold uppercase tracking-wider mb-1">Avg AI Risk</div>
                      <div className="text-3xl font-bold text-orange-900">{statsData.avgRisk}%</div>
                      <div className="text-xs text-orange-500 mt-1">detection probability</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">Failed to load statistics.</div>
                )}
              </div>
              
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                <button onClick={() => setShowStats(false)} className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Left Column: Create New Project */}
        <div className="lg:col-span-1 bg-white p-5 rounded-xl shadow-sm border border-gray-200 h-fit">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-gray-500" />
            Ingest New Corpus
          </h2>
          <form onSubmit={handleIngest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
              <input 
                type="text" 
                required
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border text-gray-900 font-medium"
                placeholder="e.g. CVPR_2023_Abstracts"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
              <select 
                value={domain}
                onChange={e => setDomain(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border text-gray-900 font-medium"
              >
                <option value="CS">Computer Science</option>
                <option value="Bio">Biology & Medicine</option>
                <option value="Humanities">Humanities & Social Sciences</option>
                <option value="General">General Academic</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Raw AI Generated Text</label>
              <textarea 
                required
                value={textContent}
                onChange={e => setTextContent(e.target.value)}
                rows={8}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border font-mono text-sm text-gray-900 font-medium placeholder-gray-400"
                placeholder="Paste raw AI generated text here. The system will automatically chunk it into segments of 200-500 tokens..."
              />
            </div>
            <button 
              type="submit" 
              disabled={isIngesting}
              className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition disabled:opacity-50"
            >
              {isIngesting ? 'Chunking...' : <><Plus className="w-4 h-4" /> Ingest & Chunk</>}
            </button>
          </form>
        </div>

        {/* Right Column: Project List */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-500" />
            Project Lab Workspaces
          </h2>
          
          {isLoading ? (
            <div className="animate-pulse flex space-x-4">
              <div className="flex-1 space-y-4 py-1">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                </div>
              </div>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No projects found. Ingest some text to start building your dataset.
            </div>
          ) : (
            <div className="grid gap-4">
              {projects.map((proj) => (
                <Link href={`/factory/project/${proj.id}`} key={proj.id}>
                  <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition cursor-pointer group">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-blue-700 group-hover:text-blue-800">{proj.name}</h3>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full border border-gray-200">
                        {proj.domain}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <List className="w-4 h-4" /> 
                        {proj.factory_segments?.[0]?.count || 0} Segments
                      </span>
                      <span>Created: {new Date(proj.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}