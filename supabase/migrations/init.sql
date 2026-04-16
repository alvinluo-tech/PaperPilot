-- Create ENUMs for section types and modes
CREATE TYPE section_type AS ENUM ('title', 'abstract', 'introduction', 'literature_review', 'methods', 'results', 'discussion', 'conclusion', 'unknown');

-- Create Users table (mirrors auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger to automatically create a profile for new users
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- documents
CREATE TABLE public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    language TEXT,
    discipline TEXT,
    citation_style TEXT,
    raw_text TEXT NOT NULL,
    normalized_text TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- document_assets
CREATE TABLE public.document_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    asset_type TEXT,
    file_path TEXT,
    metadata_json JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- paragraphs
CREATE TABLE public.paragraphs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    section_type section_type DEFAULT 'unknown',
    order_index INT NOT NULL,
    raw_text TEXT NOT NULL,
    current_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- diagnoses
CREATE TABLE public.diagnoses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paragraph_id UUID REFERENCES public.paragraphs(id) ON DELETE CASCADE,
    tags_json JSONB,
    severity TEXT,
    evidence_spans_json JSONB,
    explanation TEXT,
    revision_priority TEXT,
    model_name TEXT,
    prompt_version TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- revision_plans
CREATE TABLE public.revision_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paragraph_id UUID REFERENCES public.paragraphs(id) ON DELETE CASCADE,
    goals_json JSONB,
    constraints_json JSONB,
    suggested_actions_json JSONB,
    evidence_slots_json JSONB,
    recommended_modes_json JSONB,
    style_alignment_notes_json JSONB,
    model_name TEXT,
    prompt_version TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- terminology_locks
CREATE TABLE public.terminology_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    source TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- rewrite_candidates
CREATE TABLE public.rewrite_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paragraph_id UUID REFERENCES public.paragraphs(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.revision_plans(id) ON DELETE CASCADE,
    mode TEXT,
    rewritten_text TEXT NOT NULL,
    rationale TEXT,
    model_name TEXT,
    prompt_version TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- validation_reports
CREATE TABLE public.validation_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES public.rewrite_candidates(id) ON DELETE CASCADE,
    semantic_consistency TEXT,
    terminology_preserved BOOLEAN,
    citation_alignment BOOLEAN,
    deterministic_report_json JSONB,
    blocked_reasons_json JSONB,
    validator_notes TEXT,
    model_name TEXT,
    prompt_version TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- user_actions
CREATE TABLE public.user_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paragraph_id UUID REFERENCES public.paragraphs(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES public.rewrite_candidates(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    edited_text TEXT,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- revision_sessions
CREATE TABLE public.revision_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT now(),
    finished_at TIMESTAMPTZ,
    status TEXT
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paragraphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revision_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminology_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewrite_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revision_sessions ENABLE ROW LEVEL SECURITY;

-- CREATE RLS POLICIES
CREATE POLICY "Users can manage their own profile" ON public.users FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can manage their own documents" ON public.documents
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own document assets" ON public.document_assets
    FOR ALL USING (EXISTS (SELECT 1 FROM public.documents WHERE documents.id = document_id AND documents.user_id = auth.uid()));

CREATE POLICY "Users can manage their own paragraphs" ON public.paragraphs
    FOR ALL USING (EXISTS (SELECT 1 FROM public.documents WHERE documents.id = document_id AND documents.user_id = auth.uid()));

CREATE POLICY "Users can manage their own diagnoses" ON public.diagnoses
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.paragraphs p 
        JOIN public.documents d ON p.document_id = d.id 
        WHERE p.id = paragraph_id AND d.user_id = auth.uid()
    ));

CREATE POLICY "Users can manage their own revision_plans" ON public.revision_plans
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.paragraphs p 
        JOIN public.documents d ON p.document_id = d.id 
        WHERE p.id = paragraph_id AND d.user_id = auth.uid()
    ));

CREATE POLICY "Users can manage their own terminology_locks" ON public.terminology_locks
    FOR ALL USING (EXISTS (SELECT 1 FROM public.documents WHERE documents.id = document_id AND documents.user_id = auth.uid()));

CREATE POLICY "Users can manage their own rewrite_candidates" ON public.rewrite_candidates
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.paragraphs p 
        JOIN public.documents d ON p.document_id = d.id 
        WHERE p.id = paragraph_id AND d.user_id = auth.uid()
    ));

CREATE POLICY "Users can manage their own validation_reports" ON public.validation_reports
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.rewrite_candidates rc 
        JOIN public.paragraphs p ON rc.paragraph_id = p.id 
        JOIN public.documents d ON p.document_id = d.id 
        WHERE rc.id = candidate_id AND d.user_id = auth.uid()
    ));

CREATE POLICY "Users can manage their own user_actions" ON public.user_actions
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.paragraphs p 
        JOIN public.documents d ON p.document_id = d.id 
        WHERE p.id = paragraph_id AND d.user_id = auth.uid()
    ));

CREATE POLICY "Users can manage their own revision_sessions" ON public.revision_sessions
    FOR ALL USING (EXISTS (SELECT 1 FROM public.documents WHERE documents.id = document_id AND documents.user_id = auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_documents_user_id ON public.documents(user_id);
CREATE INDEX idx_document_assets_document_id ON public.document_assets(document_id);
CREATE INDEX idx_paragraphs_document_id ON public.paragraphs(document_id);
CREATE INDEX idx_diagnoses_paragraph_id ON public.diagnoses(paragraph_id);
CREATE INDEX idx_revision_plans_paragraph_id ON public.revision_plans(paragraph_id);
CREATE INDEX idx_terminology_locks_document_id ON public.terminology_locks(document_id);
CREATE INDEX idx_rewrite_candidates_paragraph_id ON public.rewrite_candidates(paragraph_id);
CREATE INDEX idx_rewrite_candidates_plan_id ON public.rewrite_candidates(plan_id);
CREATE INDEX idx_validation_reports_candidate_id ON public.validation_reports(candidate_id);
CREATE INDEX idx_user_actions_paragraph_id ON public.user_actions(paragraph_id);
CREATE INDEX idx_revision_sessions_document_id ON public.revision_sessions(document_id);