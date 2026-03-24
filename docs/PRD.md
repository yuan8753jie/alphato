# AlphaTo — 产品需求文档 (PRD)

> 版本：0.2 | 日期：2026-03-24 | 状态：Draft

---

## 1. 产品定位

AlphaTo 是一个 **AI 驱动的社交媒体内容运营平台**。它帮助社媒运营者从"不知道发什么"到"打开就有做好的 Demo"，将选题发现、脚本创作、图文视频生成整合为一条自治流水线。

**一句话价值：** 你睡觉的时候，AI 已经帮你找好了选题、写好了脚本、做好了 Demo。

---

## 2. 目标用户

### V1 首要用户
创始人自己的 10 人运营团队，为多家企业运营抖音社媒账号。

### 用户画像

| 角色 | 描述 | 核心场景 |
|------|------|---------|
| **运营执行者** | 团队成员，负责具体客户的账号 | 每天找选题、写脚本、做内容，花大量时间刷热点 |
| **运营负责人** | 创始人/team lead | 审核选题质量，把控品牌调性，规划营销日历 |
| **外部客户** | 被服务的企业 | 查看、审批运营团队提交的选题和 Demo（只读分享） |

### 未来用户（非 V1 范围）
- Prosumer（个人博主、小型 Agency）
- 企业直接使用
- AI Agent（通过 MCP/Skill 调用）

---

## 3. 核心问题

| # | 问题 | 当前解法 | AlphaTo 解法 |
|---|------|---------|-------------|
| 1 | **不知道发什么** — 每天找选题花费大量时间，信息源分散 | 团队各自刷多个平台，丢到群里，每天晨会脑暴整理 | AI 7×24 自动抓取热点，自动匹配账号，虚拟受众评估筛选 |
| 2 | **想法→Demo 人力成本高** — 无法具象地看到更多可能性 | 手动写脚本，用剪映/可灵精细制作，一个想法走完流程要数小时 | 选题自动推进到脚本→Demo，Reactive 5分钟，Proactive 自动完成 |
| 3 | **协作效率低** — 太多时间花在做表做周报 | 飞书表格管理选题表、营销日历，手动同步 | 系统自带选题管理和营销日历，一键分享给客户 |

---

## 4. 产品架构

### 4.1 三层数据架构

```
┌─────────────────────────────────────────────┐
│          热点池 (Global Topic Feed)           │
│  AI 自动抓取，全局共享，所有账号可见            │
│  来源：抖音热点宝、新闻、行业事件、对标账号等    │
└──────────────────┬──────────────────────────┘
                   │ 自动匹配 + 人工推送
                   ▼
┌─────────────────────────────────────────────┐
│        账号工作区 (Account Workspace)          │
│  每个账号独立的知识库 + 选题候选 + 营销日历     │
│  系统自动计算"热点×账号"匹配度                  │
└──────────────────┬──────────────────────────┘
                   │ 审批通过后推进
                   ▼
┌─────────────────────────────────────────────┐
│        内容流水线 (Content Pipeline)           │
│  选题 → 脚本 → 分镜 → Demo (图文/视频)        │
│  每个账号独立，基于自己的品牌上下文生成          │
└─────────────────────────────────────────────┘
```

### 4.2 账号知识库模型

账号不是一个简单标签，而是一个**完整的知识库**，为 AI 创作提供上下文：

```
Account = {
  // 基础信息
  name: string,              // 账号名称
  platform: enum,            // 抖音 | TikTok | 小红书 | ...
  account_url: string?,      // 账号链接（可选，用于自动分析）

  // 品牌上下文
  brand: {
    name: string,            // 品牌名
    tone: string,            // 调性描述（如："年轻活泼，偏口语化"）
    rules: string[],         // 规则/红线（如："不提竞品名字"、"不用负面情绪"）
    industry: string,        // 所属行业
  },

  // 产品库
  products: [
    {
      name: string,
      description: string,
      selling_points: string[],  // 核心卖点
      images: file[],            // 三视图/白底图
      links: string[],           // 相关链接
    }
  ],

  // 受众 Persona（AI 自动生成 + 用户可调）
  personas: [
    {
      name: string,           // 如 "25岁新手妈妈小王"
      demographics: string,
      interests: string[],
      pain_points: string[],
      content_preferences: string,
    }
  ],

  // 对标账号
  benchmark_accounts: [
    { url: string, notes: string }
  ],

  // 营销日历
  calendar: CalendarEntry[]
}
```

### 4.3 两种运行模式

#### Proactive 模式（自治流水线）

```
定时触发（如凌晨2点）
  │
  ├─ Step 1: 抓取热点 → 写入热点池
  │
  ├─ Step 2: 热点 × 账号匹配度计算
  │          低匹配 → 跳过
  │          高匹配 → 进入候选
  │
  ├─ Step 3: 虚拟受众评估
  │          为每个候选选题，用账号的 Persona 做模拟 Review
  │          评估维度：会看完？会互动？会转化？
  │          综合低分 → 自动放弃
  │          综合高分 → 自动推进
  │
  ├─ Step 4: 生成脚本
  │          基于账号品牌上下文 + 产品信息
  │          多角色 Review（导演视角、观众视角、品牌视角）
  │
  ├─ Step 5: 生成 Demo
  │          图文：直接生成成品图+文案
  │          视频：脚本 → 分镜 → 素材匹配/AI生成 → 粗剪
  │
  └─ 结果：用户早上打开，看到已做好的 Demo
           操作：👍 好 / 👎 不好 / 🤔 待定
```

- 每账号每天生成 **5~10 个选题**（可配置）
- 选题→Demo 允许 **20~30 分钟**
- Token 消耗较大，未来作为 Pro 功能

#### Reactive 模式（用户触发）

```
用户操作（手动输入想法 / 选中热点 / 对话交互）
  │
  └─ 按需执行 Pipeline 的任意环节
     选题→脚本→Demo，目标 5 分钟内完成
```

---

## 5. 功能清单与版本规划

### V0.1 — 第1周：核心链路跑通

> 目标：1个账号，Reactive 模式，Web 端，选题→脚本质量达到60分

| 功能 | 描述 | 优先级 |
|------|------|--------|
| **API 冒烟测试** | Day 1 验证豆包、Nano Banana 等 API 可用性（账号审核、配额等） | P0 |
| **创建/编辑账号工作区** | 品牌信息、调性、规则、产品信息（文本）、目标受众 Persona（文本） | P0 |
| **热点抓取** | 手动触发，LLM Search 抓取当日热点列表 | P0 |
| **选题生成** | 基于热点+账号上下文+Persona，AI 生成选题推荐列表 | P0 |
| **选题审批** | 用户对选题标记：好 / 不好 / 待定 | P0 |
| **脚本生成** | 选中选题后，AI 生成完整短视频脚本（含分镜） | P0 |
| **效果调优** | 反复调整 Prompt 直到选题和脚本质量达到60分基线 | P0 |

**V0.1 不包含：** 图文/视频 Demo 生成、Proactive模式、多账号、营销日历、手机适配、分享功能、登录、数据库

### V0.5 — 第2周：Demo 生成 + 差异化体验

| 功能 | 描述 | 优先级 |
|------|------|--------|
| **图文 Demo** | 基于脚本，生成图片+配套文案（Nano Banana） | P0 |
| **视频 Demo** | 脚本→分镜→调用 Kling 生成粗剪视频 | P0 |
| **Proactive 流水线** | 定时自动跑完 抓热点→匹配→评估→脚本→Demo | P0 |
| **虚拟受众评估** | AI 自动生成 Persona + 模拟 Review 打分 | P0 |
| **Supabase 迁移** | localStorage → Supabase，支持 Proactive 后台写入和多端同步 | P0 |
| **Vercel 部署** | 连接 GitHub 自动部署，配置 Cron 和 Serverless Functions | P0 |
| **多账号** | 支持创建多个账号工作区 | P1 |
| **营销日历** | 日历视图，拖拽排期选题到具体日期 | P1 |
| **分享页面** | 生成只读链接，客户/协作者可查看选题和 Demo | P1 |
| **手机端适配** | 响应式布局，核心操作（审批选题）手机可用 | P2 |

### 远期（V1+）

- Agent 端：MCP/Skill 接口
- 合规检查
- 一键发布到平台
- 内容效果追踪（发布后的数据回流）
- 日发100条不同原创内容
- 飞书集成

---

## 6. 页面结构

### V0.1 页面

```
/                       — 主面板（无需登录）
/setup                  — 创建/编辑账号工作区（品牌信息、产品、Persona、对标账号）
/topics                 — 今日选题列表（热点+AI推荐）
/topics/:id             — 选题详情 → 脚本
```

### V0.5 新增

```
/login                  — 登录/注册（Supabase Auth）
/dashboard              — 多账号总览面板
/calendar               — 营销日历视图
/proactive              — Proactive 流水线状态和产出
/share/:token           — 外部分享页（只读）
```

### 关键交互

**选题列表页：**
- 卡片式布局，每张卡片 = 1个选题
- 显示：标题、关联热点、匹配度评分、受众评估分数
- 操作：👍 👎 🤔 三个按钮 + "生成脚本"
- Proactive 产出的带 ✨ 标记，已含脚本/Demo

**选题详情页：**
- 上方：选题信息 + 受众评估详情
- 中部：脚本（可编辑）+ 分镜表
- 下方：Demo 预览（图文/视频）
- 侧边：品牌上下文参考（当前用的哪些品牌规则/产品信息）

---

## 7. 技术架构

### V0.1 技术栈

| 层 | 选择 | 说明 |
|---|------|------|
| 前端 | Next.js 15 (App Router) | 本地开发 localhost:3000 |
| UI | Tailwind CSS + shadcn/ui | 快速开发，风格统一 |
| 数据持久化 | localStorage | V0.1 单用户，无需数据库 |
| 产品测试图 | public/test-assets/ | 创始人提供固定测试图片 |
| AI 编排 | Next.js API Routes → 各模型 API | 可插拔 Provider |

### V0.5 升级技术栈

| 层 | 选择 | 说明 |
|---|------|------|
| 部署 | Vercel (Pro) | 300s Function 时长 |
| 数据库 | Supabase (PostgreSQL) | Proactive 需要后台写入，多端同步 |
| 文件存储 | Supabase Storage | 生成的图片/视频 Demo |
| 后台任务 | Vercel Cron + 链式 Serverless Functions | Proactive Pipeline |
| 认证 | Supabase Auth | 邮箱登录 |

### Proactive Pipeline 实现（V0.5）

利用 Vercel Cron 触发 + Supabase 状态流转，每个步骤是独立 Serverless Function：

```
Cron (0 2 * * *) → /api/pipeline/fetch-trends
  → 写入 trends 表
  → 触发 /api/pipeline/match-accounts
    → 写入 topic_candidates 表
    → 触发 /api/pipeline/audience-review
      → 更新 candidate 状态和分数
      → 高分的触发 /api/pipeline/generate-script
        → 写入 scripts 表
        → 触发 /api/pipeline/generate-demo
          → 写入 demos 表，关联图片/视频文件
```

每个 Function 通过 Supabase Database Webhooks 或直接 HTTP 调用触发下一步。每步状态写入 DB，失败可重试。

### AI 模型配置

| 用途 | 模型 | 说明 |
|------|------|------|
| 国内热点抓取 | 豆包 (Doubao) + Search | 联网搜索获取实时热点 |
| 国内选题/脚本 | 豆包 (Doubao) | 最懂抖音语境和国内梗 |
| 海外热点发现 | Grok + Search | 接入 X/Twitter 实时数据 |
| 海外文案 | Claude | 创意写作强，语感自然 |
| 虚拟受众评估 | 豆包 / Claude | 复用脚本模型即可 |
| 图片生成 | Nano Banana | — |
| 视频生成 | Kling (可灵) | — |

模型层做成可插拔 Provider 接口，方便未来切换或新增。

---

## 8. 数据模型

### V0.1 — localStorage JSON 结构

V0.1 所有数据存储在浏览器 localStorage 中，结构如下：

```json
{
  "account": {
    "name": "品牌A抖音号",
    "platform": "douyin",
    "accountUrl": "",
    "brand": {
      "name": "品牌A",
      "tone": "年轻活泼，偏口语化",
      "rules": ["不提竞品名字", "不用负面情绪"],
      "industry": "母婴"
    },
    "products": [
      {
        "name": "产品X",
        "description": "...",
        "sellingPoints": ["卖点1", "卖点2"],
        "imagePaths": ["/test-assets/product-x-front.png"],
        "links": []
      }
    ],
    "personas": [
      {
        "name": "新手妈妈小王",
        "description": "25岁，第一个宝宝6个月大，关注辅食和早教，价格敏感，喜欢看真实测评"
      }
    ],
    "benchmarkAccounts": [
      { "url": "https://www.douyin.com/user/xxx", "notes": "同品类头部账号" }
    ]
  },
  "topics": [],
  "scripts": []
}
```

### V0.5 — Supabase 表结构（迁移时建立）

```sql
-- 用户
users (由 Supabase Auth 管理)

-- 账号工作区
accounts
  id, user_id, name, platform, account_url,
  brand_name, brand_tone, brand_rules (jsonb), industry,
  created_at, updated_at

-- 产品库
products
  id, account_id, name, description,
  selling_points (jsonb), images (jsonb), links (jsonb),
  created_at

-- 受众 Persona
personas
  id, account_id, name, description,
  is_auto_generated (bool), created_at

-- 对标账号
benchmark_accounts
  id, account_id, url, notes, created_at

-- 热点池
trends
  id, source, title, description, url,
  heat_score, category, fetched_at, expires_at

-- 选题候选
topic_candidates
  id, account_id, trend_id,
  title, angle, description,
  match_score, audience_score (jsonb),
  status (enum: pending/approved/rejected/hold),
  created_at

-- 脚本
scripts
  id, topic_candidate_id, account_id,
  content (jsonb: 含分镜表),
  review_scores (jsonb),
  version, created_at

-- Demo
demos
  id, script_id, account_id,
  type (enum: image/video),
  files (jsonb: 图片URL/视频URL),
  caption (text: 配套文案),
  status (enum: generating/ready/failed),
  created_at

-- 营销日历
calendar_entries
  id, account_id, topic_candidate_id,
  scheduled_date, status, notes, created_at

-- Pipeline 执行记录
pipeline_runs
  id, account_id, step, status,
  input (jsonb), output (jsonb), error,
  started_at, completed_at
```

---

## 9. 质量基线与验收标准

**AlphaTo 的核心是效果，不只是功能。**

### 质量评分标准

| 环节 | 60分（最低可接受，V0.1 必须达到） | 80分（良好，V0.5 目标） |
|------|--------------------------------|----------------------|
| **选题** | 和账号品类相关，蹭到了真实热点，不离谱 | 角度新颖，有传播潜力，团队会说"这个不错" |
| **脚本** | 结构完整(hook+内容+CTA)，语言通顺，时长合理 | 有记忆点，语言有抖音感，能直接拿去拍 |
| **图片** | 主题相关，画面清晰，文字可读 | 风格统一，有品牌感，产品融合自然 |
| **视频** | 画面连贯，节奏基本合理，不出戏 | 卡点准确，转场流畅，口播自然 |

### 验收流程

1. 选取 **3~5 个真实客户账号** 作为测试用例
2. 每个账号跑完整链路，产出选题→脚本→Demo
3. 创始人 + 团队成员 **独立打分**（60分制）
4. **平均分 < 60：** 调整 Prompt / 换模型 / 优化上下文注入，继续迭代
5. **平均分 ≥ 60：** 该环节通过，进入下一阶段开发
6. 重点记录：哪些 case 效果好、哪些差、差在哪里 → 指导 Prompt 迭代方向

### 效果线开发策略

| 阶段 | 聚焦 | 理由 |
|------|------|------|
| V0.1 第1周 | 选题 + 脚本效果 | 纯文本，迭代快，成本低 |
| V0.5 第2周 | 图片 + 视频效果 | 每次生成有成本，等文本链路稳定后再攻 |

---

## 10. 开发路线图

### V0.1 — 第1周

**Day 1：基础设施 + API 验证**
- [ ] 初始化 Next.js 项目（App Router + Tailwind + shadcn/ui）
- [ ] 创建 GitHub 仓库，推送初始代码
- [ ] **API 冒烟测试**：豆包 API 发一条请求验证可用性（账号审核、配额等提前暴露）
- [ ] 产品测试图片放入 public/test-assets/

**Day 2：账号配置**
- [ ] 账号工作区创建/编辑页面（品牌信息、规则、产品信息、Persona 文本描述、对标账号）
- [ ] 数据存入 localStorage

**Day 3-4：核心链路**
- [ ] 热点抓取功能（手动触发，豆包 LLM Search）
- [ ] 选题生成（基于热点 + 账号上下文 + Persona，Prompt 工程）
- [ ] 选题列表页面 + 审批操作（好/不好/待定）
- [ ] 脚本生成（选中选题 → 完整短视频脚本含分镜表）

**Day 5-7（+1天缓冲）：效果调优**
- [ ] 选题详情页完整交互
- [ ] **效果验证**：用 3~5 个真实客户账号跑 case，创始人+团队打分
- [ ] 反复调 Prompt 直到选题和脚本平均分 ≥ 60
- [ ] Plan B：效果调优最多溢出到 Day 8，V0.5 从 Day 9 开始

### V0.5 — 第2周

**Day 9-10：Supabase + Vercel + Demo 生成**
- [ ] Supabase 项目创建，建表，localStorage 数据迁移
- [ ] Vercel 部署，连接 GitHub
- [ ] 图文 Demo 生成（Nano Banana API 对接）
- [ ] 视频 Demo 生成（Kling API 对接）

**Day 11-12：Proactive Pipeline**
- [ ] Vercel Cron 定时任务
- [ ] Pipeline 链式 Function（5步）
- [ ] Persona 自动生成 + 虚拟受众 Review 评分

**Day 13-14：多账号 + 日历 + 分享**
- [ ] 多账号支持
- [ ] 营销日历视图
- [ ] 外部分享链接
- [ ] 手机端响应式适配
- [ ] **效果验证**：全链路跑 case，Proactive 产出质量达标

---

## 附录

### A. 热点信息源（V1 优先级）

V1 的热点获取策略：**统一通过 LLM Search 能力抓取**，不自建爬虫。对标账号单独通过平台 API 获取。

| 来源 | 类型 | 获取方式 |
|------|------|---------|
| 抖音热点/趋势 | 平台热点 | LLM Search（如豆包联网搜索） |
| 大众新闻 | 社会热点 | LLM Search |
| 行业新闻/事件 | 行业热点 | LLM Search |
| 历史上的今天 | 内容灵感 | LLM Search / LLM 知识 |
| 品类冷知识 | 内容灵感 | LLM 生成 |
| 最新表现形式/创意趋势 | 创意灵感 | LLM Search |
| 对标账号动态 | 竞品动态 | 平台 API（需单独对接） |

这样做的好处：
- 不需要维护爬虫基础设施，降低 V1 开发成本
- LLM Search 天然具备信息整合和摘要能力，返回的就是可用的热点描述
- 未来如果发现某个信息源需要更高频/更精准的抓取，再针对性补充专用数据源

### B. 平台适配优先级

抖音 > TikTok > 小红书 > Instagram > 快手 > 微信视频号 > YouTube > Bilibili

V1 仅做抖音。平台差异主要体现在：视频尺寸/时长规范、文案风格、标签策略、热点来源。

### C. 竞品 & 关联产品

- **Clipo (clipo.cc)：** 创始人自研混剪工具，AlphaTo 是其下一代（包含关系）
- **抖音矩阵宝：** 账号管理工具，AlphaTo 不做账号管理和矩阵裂变
- **剪映 / 可灵 / 即梦：** 视频制作工具，AlphaTo 调用其 API 而非替代
