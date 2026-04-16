"use client";

import React from 'react';
import { AlertCircle, CheckCircle, Edit3, Target, Info, Loader } from 'lucide-react';
import { useDocument } from '../../context/DocumentContext';

export function RightPanel() {
  const { diagnosisData, planData, candidatesData, validationData } = useDocument();

  return (
    <div className="w-80 h-full bg-white border-l border-gray-200 flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Inspector</h2>
      </div>

      {/* Diagnosis Section */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-orange-500" />
          Risk Diagnosis
        </h3>
        
        {!diagnosisData ? (
          <p className="text-sm text-gray-400 italic">No diagnosis available. Click 'Analyze Selected' on a paragraph.</p>
        ) : (
          <div className="space-y-3">
            <div className="bg-orange-50 p-3 rounded-md border border-orange-100">
              <div className="flex items-start justify-between">
                <span className="text-sm font-semibold text-orange-800">Severity: {diagnosisData.severity}</span>
              </div>
              <p className="text-xs text-orange-700 mt-1 font-medium">{diagnosisData.explanation}</p>
            </div>
            
            {diagnosisData.tags_json?.map((tag: string, idx: number) => (
              <span key={idx} className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full mr-2 mb-2 border border-gray-200">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Revision Plan */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-500" />
          Revision Plan
        </h3>
        
        {!planData ? (
          <p className="text-sm text-gray-400 italic">No plan available.</p>
        ) : (
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
            {planData.goals_json?.map((goal: string, idx: number) => (
              <li key={idx}>{goal}</li>
            ))}
            {planData.constraints_json?.map((c: string, idx: number) => (
              <li key={`c-${idx}`} className="text-purple-600 font-medium">Keep: {c}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Candidates */}
      <div className="p-4 border-b border-gray-200 flex-1">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Edit3 className="w-4 h-4 text-green-500" />
          Rewrite Candidates
        </h3>
        
        {!candidatesData ? (
          <p className="text-sm text-gray-400 italic">No candidates generated.</p>
        ) : (
          <div className="space-y-4">
            {candidatesData.map((candidate: any, idx: number) => (
              <div key={idx} className="border border-green-200 bg-green-50 p-3 rounded-md shadow-sm relative">
                <div className="absolute top-2 right-2 flex items-center space-x-1 text-green-600 text-xs font-medium">
                  <span className="bg-green-200 px-1.5 py-0.5 rounded">{candidate.mode}</span>
                </div>
                <p className="text-sm text-gray-800 mb-3 mt-6">
                  {candidate.rewritten_text}
                </p>
                <div className="flex space-x-2">
                  <button className="flex-1 bg-white border border-green-300 text-green-700 py-1.5 text-xs font-medium rounded hover:bg-green-100 transition">
                    Accept
                  </button>
                  <button className="flex-1 bg-white border border-gray-300 text-gray-700 py-1.5 text-xs font-medium rounded hover:bg-gray-50 transition">
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Terms & Citations */}
      <div className="p-4 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Info className="w-4 h-4 text-purple-500" />
          Locked Terms
        </h3>
        <div className="flex flex-wrap gap-2">
           <p className="text-xs text-gray-500">Feature coming soon...</p>
        </div>
      </div>
    </div>
  );
}