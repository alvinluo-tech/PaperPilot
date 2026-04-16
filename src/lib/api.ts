/**
 * Frontend API client to interact with PaperPilot backend services.
 */

export const apiClient = {
  /**
   * Upload a document for ingestion and paragraph segmentation
   */
  async ingestDocument(title: string, raw_text: string) {
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, raw_text }),
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to ingest document");
    }
    return res.json();
  },

  /**
   * Run risk diagnosis on a specific paragraph
   */
  async diagnoseParagraph(paragraphId: string) {
    const res = await fetch(`/api/paragraphs/${paragraphId}/diagnose`, {
      method: "POST",
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to diagnose paragraph");
    }
    return res.json();
  },

  /**
   * Create an enhancement plan based on a paragraph's diagnosis
   */
  async planEnhancement(paragraphId: string) {
    const res = await fetch(`/api/paragraphs/${paragraphId}/plan`, {
      method: "POST",
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to create enhancement plan");
    }
    return res.json();
  },

  /**
   * Generate rewrite candidates for a paragraph
   */
  async rewriteParagraph(paragraphId: string, mode: string = "academic_rigorous") {
    const res = await fetch(`/api/paragraphs/${paragraphId}/rewrite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to rewrite paragraph");
    }
    return res.json();
  },

  /**
   * Validate a specific rewrite candidate
   */
  async validateCandidate(candidateId: string) {
    const res = await fetch(`/api/candidates/${candidateId}/validate`, {
      method: "POST",
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to validate candidate");
    }
    return res.json();
  },
};
