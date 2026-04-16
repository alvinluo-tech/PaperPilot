# PaperPilot 项目说明书 v1.1

## 一、项目概述

### 项目名称
PaperPilot

### 项目定位
PaperPilot 是一个 **Academic Writing Enhancer（学术写作增强器）**，核心目标是帮助用户将 AI 辅助草稿转化为：

1. 更符合学术规范的文本  
2. 更具作者性（Authorship）的文本  
3. 更具修订可追溯性（Traceability）的文本  
4. 更适合人工审阅和解释的文本  

PaperPilot **不是**：
- AI detector bypass tool
- stealth writer
- undetectable writer
- “降 AIGC 率工具”
- “规避 Turnitin / GPTZero”工具

PaperPilot 的核心价值不是“骗过检测器”，而是通过 **诊断、规划、受约束修订、验证、修订留痕** 来增强文本质量和作者性证据。

---

## 二、产品哲学

### 核心理念
与其在 detector 对抗中卷“谁更会躲”，不如直接提升：

- **Authorship（作者性）**
- **Traceability（修订轨迹）**
- **Academic Quality（学术质量）**
- **Human-in-the-loop（人在回路）**

### 为什么这样设计
已有公开信息和研究表明：
- AI detector 本身存在 false positive 风险，尤其对 formal、模板化、non-native 写作不稳定。
- paraphrasing 确实可以显著改变 detector 行为，但这不等于更真实、更学术、更可信。
- 真正强的“作者证据”往往来自完整修订过程，而不是一个 detector score。  

因此，PaperPilot 不以“通过 detector”作为产品 KPI，而以：
- 学术写作质量提升
- 人工修订参与度
- 修订过程可追溯
- 语义/术语/引用保真  
作为核心设计目标。

---

## 三、目标用户

### 核心用户
1. 使用 AI 辅助写作的学生
2. 需要将 AI 草稿转化为自己文本的写作者
3. 担心误报、希望保留过程证据的用户
4. 非英语母语、文风容易过于模板化的学术写作者

### 后续扩展用户
1. 导师 / 教师 / 写作中心
2. 学术编辑服务
3. 研究训练平台

---

## 四、MVP 目标

### MVP 要解决的问题
给定一篇论文草稿或一个段落，PaperPilot 能够：

1. 拆解文本结构
2. 识别学术写作中的风险标签
3. 为每段生成修订计划
4. 输出 2~3 个受约束改写版本
5. 验证改写结果是否保真
6. 允许用户人工编辑、采纳或拒绝建议
7. 保存完整修订轨迹

### MVP 不做
- 不承诺 detector 分数下降
- 不提供“绕过检测”模式
- 不自动生成虚假引用
- 不一键全文洗稿
- 不做“自动提交级”成稿生成器

---

## 五、技术栈

### 前端
- Next.js（App Router）
- TypeScript
- Tailwind CSS
- TipTap（优先）或 Lexical 作为富文本编辑器
- Diff View 组件（建议类 Git/Word 修订视图）

### 部署
- Vercel

### 后端与数据
- Supabase
  - Auth
  - Postgres
  - Storage
  - RLS（必须启用）
  - Realtime（可选）
- ORM：Drizzle 或 Prisma（二选一）
- Zod：全链路 schema 校验

### AI 层
- Groq API（优先，用于低成本快速测试）
- 模型必须配置化，不可写死
- 各层模型分离，支持异构验证

### Orchestration
- Next.js Serverless Functions（Node.js Runtime）承载核心编排逻辑
- 不建议将主编排逻辑放到 Edge Runtime
- Edge Functions / Supabase Edge Functions 仅做轻量 glue logic 或 webhook

### 队列与限流（建议尽早预留）
- 内部 Job Queue 抽象层
- 批处理（Batching）
- p-retry 或 bottleneck 风控
- 指数退避 + jitter
- 支持读取 Groq 的 retry-after 头

---

## 六、系统设计原则

1. **分层 pipeline，而不是单模型一把梭**
2. **每层输入输出必须结构化**
3. **所有 AI 输出必须经过 schema 校验**
4. **改写和验证必须异构**
5. **先段落级，再扩全文级**
6. **先中间结果可观察，再追求自动化**
7. **所有用户动作必须留痕**
8. **核心价值是 diagnosis + planning + traceability，不是 rewriting 本身**

---

## 七、系统总体架构

```text
User Input
  -> Document Ingestion
  -> Structural Parsing
  -> Style / Context Retrieval (Light RAG)
  -> Risk Diagnosis
  -> Enhancement Planning
  -> Constrained Rewriting
  -> Validation
  -> Human Decision
  -> Revision Trace Storage
  -> Final Export / Report
```

---

## 八、各层详细设计

## 1. Document Ingestion Layer（文档输入层）

### 目标
接收用户草稿，标准化文本，并建立可追溯的原始版本。

### 输入
- raw text
- 可选 metadata：
  - language
  - discipline
  - citation_style
  - section_hint
  - assignment_type

### 输出
- document_id
- raw_text
- normalized_text
- metadata
- initial_version_snapshot

### 处理内容
- 去除多余空白
- 统一换行与段落分隔
- 初步识别标题、摘要、正文等结构痕迹
- 初步识别引用格式

### 工程要求
- 原始文本必须永久保留
- 这一层不做语义修改
- 所有后续版本必须可回溯到这里

---

## 2. Structural Parsing Layer（结构解析层）

### 目标
将文本结构化，作为后续 diagnosis / planning 的基础。

### 任务
- 段落切分
- 句子切分
- section 分类：
  - title
  - abstract
  - introduction
  - literature_review
  - methods
  - results
  - discussion
  - conclusion
  - unknown
- paragraph function 识别：
  - topic_sentence
  - evidence
  - explanation
  - comparison
  - transition
  - claim
  - conclusion
- citation span 提取
- term candidate 提取

### 输出
- sections[]
- paragraphs[]
- sentences[]
- paragraph_role_guess
- citation_spans[]
- term_candidates[]

### 设计要求
- 输出尽量短、结构化、稳定
- 优先 machine-readable JSON
- 尽量避免长 prose explanation

### 模型建议
- Parser 首选：Llama 3.3 70B
- 中文重点可优先试 Qwen
- 可规则化的部分优先规则化（如段落切分、简单引用检测）

---

## 3. Style / Context Retrieval Layer（轻量 RAG / 风格语境层）

### 目标
为后续 planner 和 rewriter 提供用户自己的写作语境，而不是只做泛化“学术增强”。

### 功能
允许用户上传：
- 1~2 篇过往自己写的作品
- 1~2 篇参考范文
- 可选学科写作样例

### 输出
- style_features
- preferred_tone
- sentence_rhythm_profile
- domain_term_memory
- citation_habit_profile

### 用途
- 增强“作者一致性”
- 降低输出与用户既有风格差距
- 为 planner 提供 personalized constraints

### 注意
- 这不是人格模仿引擎
- 只用于 style consistency 与 authorship enhancement
- 必须在 UI 上明确告知用途

### 实现建议
- 前期做轻量版本，不做复杂向量系统也可以
- 可先用：
  - embedding + top-k retrieval
  - 或“最近上传样例拼上下文”的简化策略

---

## 4. Risk Diagnosis Layer（风险诊断层）

### 目标
识别学术写作层面的问题，而不是判断“是否 AI”。

### v1 风险标签
- T1 Template-like phrasing
- T2 Low information density
- T3 Weak evidence support
- T4 Weak author stance
- T5 Over-uniform syntax/rhythm
- T6 Generic term usage
- T7 Paragraph function imbalance
- T8 Citation-claim mismatch

### 输出
每段输出：
- paragraph_id
- tags[]
- severity
- evidence_spans[]
- explanation
- revision_priority

### 原则
- 输出“writing risk profile”
- 不输出 AI probability
- 不把 detector score 当主逻辑

### 工程实现建议
将诊断拆成两步：
1. tagger：输出标签 + span
2. explainer：根据标签生成简短解释

这样比一步到位更可控、更可调试。

### 模型建议
- Tagger：Llama 3.3 70B / Qwen
- Explanation：可用同模型或更轻量模型
- 所有结果必须经过 Zod 校验

---

## 5. Enhancement Planning Layer（增强规划层）

### 目标
将风险标签转化为“可执行修订计划”。

### 这是整个系统的核心层
PaperPilot 的真正价值不在于找问题，而在于把问题变成高质量的 revision plan。

### 输入
- paragraph text
- diagnosis tags
- evidence spans
- paragraph role
- section type
- citation spans
- terminology constraints
- style/context retrieval outputs
- user-selected mode（可为空）

### 输出
- revision_goals[]
- preserve_constraints[]
- suggested_actions[]
- optional_evidence_slots[]
- rewrite_mode_candidates[]
- style_alignment_notes[]

### planner 应该做什么
- 决定先修什么问题
- 明确不能动什么
- 给出补信息、补限定、补作者立场、补 citation 的策略
- 决定适合的 rewrite mode
- 给 rewriter 一个精确、窄范围、可约束的任务说明

### 例子
如果段落标签为：
- T2
- T4

则 planner 可能输出：
- 增加研究对象 / 范围 / 条件
- 引入比较句或限制性判断
- 不改术语
- 不删除已有 citation
- 优先使用 authorial_analysis 模式

### 模型建议
- 优先分配较强模型给 planner
- 首选：Llama 3.3 70B
- 若可用更强开源模型（如 GPT-OSS 120B），planner 是最值得优先使用的层

---

## 6. Constrained Rewriting Layer（受约束改写层）

### 目标
按照 revision plan 生成候选改写版本。

### 本层不是普通 paraphraser
它必须是一个 **rewrite under explicit academic constraints** 模块。

### 输入
- original paragraph
- revision plan
- preserve constraints
- citation spans
- term locks
- rewrite mode
- style context

### v1 rewrite mode
- academic_rigorous
- clarity_enhanced
- authorial_analysis

### 约束规则
必须满足：
- 不删除 citation anchors
- 不篡改术语锁定词
- 不改变数字、日期、百分比
- 不引入原文没有的新事实
- 不将 uncertain claim 改成 strong claim
- 不凭空生成引用
- 不大幅偏离原段语义结构

### 输出
每段建议生成 2~3 个候选：
- candidate_id
- mode
- rewritten_text
- rationale
- preserved_constraints_checklist

### 工程要求
- 所有候选版本必须可比较
- 前端需要支持 diff view
- rationale 必须显示给用户
- 不允许“直接覆盖原文”

### 模型建议
- 英文为主：Llama 系
- 中文/双语为主：Qwen 系
- 允许 AB testing 比较改写质量

---

## 7. Validation Layer（验证层）

### 目标
确保改写不会造成：
- 语义偏移
- 术语损坏
- citation 错位
- unsupported additions
- overclaim

### 核心原则
不要让同一个模型“自己写自己判”。

### 验证结构
由两类检查组成：

#### A. Model-based Validation
检查：
- semantic_consistency
- citation_alignment
- terminology_preservation
- overclaim_risk
- unsupported_addition

#### B. Deterministic Checks（强烈建议）
使用规则和代码检查：
- 数字是否一致
- 百分比是否一致
- 日期是否一致
- 作者名 / 年份 / citation anchors 是否一致
- 锁定术语是否被替换
- 引号内容是否发生不合理变动

### 输出
- validation_status
- semantic_consistency
- deterministic_check_report
- blocked_reasons[]
- validator_notes

### 推荐实现
- rewrite 用 Llama -> validator 优先用 Qwen
- rewrite 用 Qwen -> validator 优先用 Llama
- 再叠加 regex / string diff / NER / term-lock checks

### 结果处理
- 如果 deterministic checks fail，直接打回
- 如果 model-based judge fail，则标记为 high risk candidate
- 不允许未验证候选进入 final accepted state

---

## 8. Human-in-the-Loop Layer（人工决策层）

### 目标
把用户真正放进修订流程中，让“作者性”可见。

### 用户操作
- accept
- edit_then_accept
- reject
- manual_rewrite
- add_note
- lock_term
- pin_citation

### 必须记录
- 原文
- diagnosis
- revision plan
- rewrite candidates
- validator result
- user choice
- final edited text
- user note
- timestamps

### 价值
这层是整个产品中最重要的 authorship evidence 之一。

---

## 9. Revision Trace Layer（修订轨迹层）

### 目标
记录可导出的修订历史，用于：
- 用户自我回顾
- 解释修订过程
- 支持未来教师视图

### 内容
- revision sessions
- paragraph-level edits
- accepted / rejected suggestions
- user-modified deltas
- locked terms and preserved citations
- final snapshots

### 原则
这是 authorship-supporting trace，不是 detector evasion log。

---

## 九、前端 UI/UX 设计要求

### 核心界面结构
推荐三栏布局：

#### 左栏
- 文档目录 / 段落导航
- section overview

#### 中栏
- 主编辑器（TipTap）
- 显示原文 / 当前版本
- 支持 paragraph selection

#### 右栏
- 当前段 diagnosis
- revision plan
- candidate rewrites
- validator result
- locked terms / citations
- action panel

### 关键交互
1. 用户点击段落
2. 右侧 sidebar 自动同步该段的 diagnosis / plan / candidates
3. 用户可切换 diff view 比较版本
4. 用户可锁定术语和 citation
5. 用户可选择 candidate 并二次编辑

### Diff View 建议
高亮类型：
- 绿色：新增的学术增强内容
- 黄色：逻辑连接调整
- 灰色删除线：删除内容
- 锁图标：被保护术语
- 引用图标：被保护 citation anchors

---

## 十、数据模型（Supabase / Postgres）

### users
- id
- email
- created_at

### documents
- id
- user_id
- title
- language
- discipline
- citation_style
- raw_text
- normalized_text
- created_at
- updated_at

### document_assets
- id
- document_id
- asset_type（prior_writing / reference_sample / style_sample）
- file_path
- metadata_json
- created_at

### paragraphs
- id
- document_id
- section_type
- order_index
- raw_text
- current_text
- created_at
- updated_at

### diagnoses
- id
- paragraph_id
- tags_json
- severity
- evidence_spans_json
- explanation
- revision_priority
- model_name
- prompt_version
- created_at

### revision_plans
- id
- paragraph_id
- goals_json
- constraints_json
- suggested_actions_json
- evidence_slots_json
- recommended_modes_json
- style_alignment_notes_json
- model_name
- prompt_version
- created_at

### terminology_locks
- id
- document_id
- term
- source
- created_by
- created_at

### rewrite_candidates
- id
- paragraph_id
- plan_id
- mode
- rewritten_text
- rationale
- model_name
- prompt_version
- created_at

### validation_reports
- id
- candidate_id
- semantic_consistency
- terminology_preserved
- citation_alignment
- deterministic_report_json
- blocked_reasons_json
- validator_notes
- model_name
- prompt_version
- created_at

### user_actions
- id
- paragraph_id
- candidate_id
- action_type
- edited_text
- note
- created_at

### revision_sessions
- id
- document_id
- started_at
- finished_at
- status

---

## 十一、Supabase 安全与 RLS 要求

### 原则
- 所有业务表必须启用 RLS
- 任何通过客户端可访问的表都不能裸露
- RLS policy 用到的列要建立索引
- 需要从客户端环境测试 RLS，而不是只在 SQL Editor 测试

### 基础策略
- 用户只能读取和修改自己的 documents
- paragraphs / diagnoses / plans / candidates / reports 全部通过 document ownership 继承授权
- 所有 export / trace 数据只允许 owner 访问

---

## 十二、API 设计建议

### 同步短任务 API
- POST /api/documents
- POST /api/documents/:id/parse
- POST /api/paragraphs/:id/diagnose
- POST /api/paragraphs/:id/plan
- POST /api/paragraphs/:id/rewrite
- POST /api/candidates/:id/validate
- POST /api/paragraphs/:id/actions

### 异步任务 API（后续）
- POST /api/jobs/enqueue-document-analysis
- GET /api/jobs/:id/status
- POST /api/jobs/:id/retry

---

## 十三、模型选型建议（Groq 优先）

### 总原则
- 模型配置化
- 可替换
- 分层调用
- 异构验证
- 优先稳定 JSON 输出和低成本测试

### v1 推荐分工

#### Parsing / Diagnosis
- 首选：Llama 3.3 70B
- 中文可测：Qwen

#### Planning
- 首选：Llama 3.3 70B
- 若可用更强模型，优先升级 planner

#### Rewriting
- 英文优先：Llama
- 中文/双语优先：Qwen

#### Validation
- 与 rewriting 模型异构
- rewrite=Llama -> validate=Qwen
- rewrite=Qwen -> validate=Llama

#### Summarization / Export
- 可用更轻量模型

### Model Registry 要求
需要统一配置：
- parsing_model
- diagnosis_model
- planning_model
- rewriting_model
- validation_model
- summarization_model

每个配置字段包括：
- provider
- model_id
- temperature
- max_tokens
- timeout_ms
- retry_policy
- supports_json_mode

---

## 十四、Groq Rate Limit 工程应对

### 风险
Groq 对 RPM / TPM 都可能限制，大文档并发分析容易触发 429。

### 必须实现
- 请求队列
- batching
- exponential backoff
- jitter
- retry-after header handling
- idempotency key
- per-user concurrency cap

### 前端禁止
- 一次性并发请求 20 个段落到后端

### 后端建议
- 将 document 拆成 paragraph jobs
- 小批次串行 / 半并行处理
- 将失败任务记录为 retryable state

---

## 十五、运行时建议（Vercel）

### 建议
- 核心 orchestration 放在 Node.js Runtime
- 不要把长链路 pipeline 全放 Edge Runtime
- 对长任务使用异步 job 化设计
- 合理配置 function duration

### 原因
解析 -> 诊断 -> 规划 -> 改写 -> 验证 这一链路在真实长文档中很容易超时，必须避免把它实现成一个超长同步请求。

---

## 十六、Schema 与类型系统要求

### 强制要求
- 所有输入输出都定义 TypeScript interfaces
- 所有 AI 输出都必须通过 Zod 校验
- 不接受“模型返回随缘 JSON”

### 每层至少需要
- input schema
- output schema
- validation error handling
- fallback logic

### 推荐
- /lib/schemas/*
- /lib/pipeline/*
- /lib/models/*
- /lib/validators/*

---

## 十七、Prompt 工程原则

### Parsing Prompt
- 只做结构解析
- 禁止输出长解释

### Diagnosis Prompt
- 只输出标签、span、简短说明

### Planning Prompt
- 输出 revision goals、constraints、actions
- 不直接写成文

### Rewrite Prompt
- 显式声明 preserve constraints
- 明确禁止 hallucination
- 明确禁止更改 citations、numbers、locked terms

### Validation Prompt
- 只做 judge，不做重写
- 输出 pass/fail + reasons

---

## 十八、MVP 实现优先级

### P0（必须）
- 文本输入
- paragraph segmentation
- 8 个 risk tags
- revision planner
- 3 个 rewrite modes
- validator
- revision trace
- basic diff view
- terminology lock
- citation preservation
- Zod schema validation

### P1（增强）
- style/context retrieval
- user prior writing upload
- export report
- async queue
- batch orchestration
- model fallback

### P2（后续）
- 教师视图
- 协作
- 更强 style personalization
- discipline-specific templates
- dashboard analytics

---

## 十九、给 AI coder 的工程要求

1. 先做 paragraph-level pipeline，禁止一开始做全文端到端自动化。
2. 每层必须独立模块化，允许单独调用和调试。
3. 所有 LLM 输出必须经过 Zod 校验。
4. 所有模型名称、prompt 版本必须写入数据库。
5. 不允许 rewrite candidate 未验证即进入 accepted state。
6. 必须支持用户锁定术语和 citation。
7. 必须实现 revision trace。
8. 必须为 Groq 限流设计 retry / batching / queue abstraction。
9. 不允许在前端直接并发打满 AI API。
10. 产品价值核心是 authorship + traceability + academic enhancement，不是 detector evasion。

---

## 二十、一句话总结

PaperPilot 是一个以 **作者性增强、学术修订规划、受约束改写、验证保真、修订留痕** 为核心的学术写作增强器。
它不帮助用户规避 detector，而帮助用户构建更可信、更有过程证据的学术写作工作流。