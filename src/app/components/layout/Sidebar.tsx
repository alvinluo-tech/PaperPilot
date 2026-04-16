"use client";

import React from 'react';
import { FileText, List, AlignLeft, LogOut } from 'lucide-react';
import { useDocument } from '../../context/DocumentContext';
import { createClient } from '@/infrastructure/database/supabase/client';
import { useRouter } from 'next/navigation';

export function Sidebar() {
  const { paragraphs, activeParagraphId, setActiveParagraphId } = useDocument();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="w-64 h-full bg-gray-50 border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          PaperPilot
        </h2>
        <button onClick={handleLogout} className="text-gray-500 hover:text-red-500 transition-colors" title="Logout">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <List className="w-4 h-4" />
            Document Outline
          </h3>
          {paragraphs.length === 0 ? (
             <p className="text-sm text-gray-400 italic">No document loaded.</p>
          ) : (
            <ul className="space-y-2 text-sm text-gray-700">
              {paragraphs.map((p, i) => (
                <li 
                  key={p.id}
                  onClick={() => setActiveParagraphId(p.id)}
                  className={`cursor-pointer px-2 py-1 rounded truncate ${activeParagraphId === p.id ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-200'}`}
                  title={p.current_text}
                >
                  Para {i + 1}: {p.current_text.substring(0, 20)}...
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlignLeft className="w-4 h-4" />
            Section Overview
          </h3>
          <div className="bg-white p-3 rounded-md shadow-sm border border-gray-100 text-sm">
            <p className="text-gray-600 mb-2">
              <span className="font-medium text-gray-800">Current:</span> {activeParagraphId ? 'Analyzing' : 'Idle'}
            </p>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
              <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" style={{ width: activeParagraphId ? '100%' : '0%' }}></div>
            </div>
            <p className="text-xs text-gray-500">{activeParagraphId ? 'Paragraph Selected' : 'Waiting for selection'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}