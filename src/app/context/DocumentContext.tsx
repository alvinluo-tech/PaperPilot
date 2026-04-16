"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export type Paragraph = {
  id: string;
  current_text: string;
  order_index: number;
};

export type DocumentContextType = {
  documentId: string | null;
  setDocumentId: (id: string | null) => void;
  paragraphs: Paragraph[];
  setParagraphs: (paragraphs: Paragraph[]) => void;
  activeParagraphId: string | null;
  setActiveParagraphId: (id: string | null) => void;
  diagnosisData: any | null;
  setDiagnosisData: (data: any) => void;
  planData: any | null;
  setPlanData: (data: any) => void;
  candidatesData: any | null;
  setCandidatesData: (data: any) => void;
  validationData: any | null;
  setValidationData: (data: any) => void;
};

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

export function DocumentProvider({ children }: { children: ReactNode }) {
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [activeParagraphId, setActiveParagraphId] = useState<string | null>(null);
  
  // AI State per paragraph (for simplicity in MVP, we just store the current active paragraph's data)
  const [diagnosisData, setDiagnosisData] = useState<any | null>(null);
  const [planData, setPlanData] = useState<any | null>(null);
  const [candidatesData, setCandidatesData] = useState<any | null>(null);
  const [validationData, setValidationData] = useState<any | null>(null);

  return (
    <DocumentContext.Provider
      value={{
        documentId,
        setDocumentId,
        paragraphs,
        setParagraphs,
        activeParagraphId,
        setActiveParagraphId,
        diagnosisData,
        setDiagnosisData,
        planData,
        setPlanData,
        candidatesData,
        setCandidatesData,
        validationData,
        setValidationData,
      }}
    >
      {children}
    </DocumentContext.Provider>
  );
}

export function useDocument() {
  const context = useContext(DocumentContext);
  if (context === undefined) {
    throw new Error("useDocument must be used within a DocumentProvider");
  }
  return context;
}
