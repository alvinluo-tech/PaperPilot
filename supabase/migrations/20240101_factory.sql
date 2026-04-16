-- Create Tables for Data Factory (Internal Admin Use)

-- 1. projects (任务管理)
CREATE TABLE public.factory_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE -- For tracking which admin created it
);

-- 2. segments (原文分段)
CREATE TABLE public.factory_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.factory_projects(id) ON DELETE CASCADE,
    original_content TEXT NOT NULL,
    word_count INTEGER,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. rewrites (改写尝试)
CREATE TABLE public.factory_rewrites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_id UUID REFERENCES public.factory_segments(id) ON DELETE CASCADE,
    model_version TEXT NOT NULL,
    prompt_config JSONB,
    output_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. evaluations (综合评分)
CREATE TABLE public.factory_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rewrite_id UUID REFERENCES public.factory_rewrites(id) ON DELETE CASCADE,
    score_semantic FLOAT, -- 0-1
    score_risk FLOAT, -- 0-1
    score_llm_judge INTEGER, -- 1-10
    llm_judge_reason TEXT,
    human_vote BOOLEAN, -- true for thumb up, false for thumb down, null for none
    is_gold_standard BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.factory_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factory_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factory_rewrites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factory_evaluations ENABLE ROW LEVEL SECURITY;

-- CREATE RLS POLICIES (Assuming admins are just authenticated users for now, can restrict by role later)
CREATE POLICY "Admins can manage factory_projects" ON public.factory_projects FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage factory_segments" ON public.factory_segments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage factory_rewrites" ON public.factory_rewrites FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage factory_evaluations" ON public.factory_evaluations FOR ALL USING (auth.role() = 'authenticated');

-- Create indexes for performance
CREATE INDEX idx_factory_segments_project_id ON public.factory_segments(project_id);
CREATE INDEX idx_factory_rewrites_segment_id ON public.factory_rewrites(segment_id);
CREATE INDEX idx_factory_evaluations_rewrite_id ON public.factory_evaluations(rewrite_id);
CREATE INDEX idx_factory_evaluations_gold ON public.factory_evaluations(is_gold_standard);
