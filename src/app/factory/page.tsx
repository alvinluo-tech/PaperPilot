"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@/infrastructure/database/supabase/client';
import { Database, FileText, Upload, Plus, Download, BarChart2, List } from 'lucide-react';
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-slate-900 text-white p-4 shadow-md flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Database className="w-6 h-6 text-blue-400" />
          <h1 className="text-xl font-bold tracking-tight">PaperPilot Data Factory</h1>
          <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-0.5 rounded border border-blue-500/30 ml-2">AIGC LoRA Lab</span>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-1.5 text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded transition">
            <BarChart2 className="w-4 h-4" /> Stats
          </button>
          <a href="/api/factory/export?format=sharegpt" download className="flex items-center gap-1.5 text-sm bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded transition">
            <Download className="w-4 h-4" /> Export JSONL
          </a>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
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
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border"
                placeholder="e.g. CVPR_2023_Abstracts"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
              <select 
                value={domain}
                onChange={e => setDomain(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border"
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
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border font-mono text-sm"
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