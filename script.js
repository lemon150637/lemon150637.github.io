/* ============================================================
 * 作品集数据与渲染
 * ★ 修改作品信息请编辑下方 DATA 对象（zh = 中文，en = 英文）
 * ★ Coze 智能体链接为扣子商店真实分享链接，卡片可站内 iframe 体验
 * ============================================================ */

const DATA = {
  zh: {
    hero: {
      eyebrow: "泛 AI 产品经理 · AI 原生工作流",
      title: "用 AI 把想法变成<br/><em>能上线的产品</em>",
      sub: "我不只写 PRD——从用户场景、产品文档，到数据流水线、双端开发、部署上线，全程用 AI 工具链交付。这里是我的全部作品。",
      stat1: "个交付产品", stat2: "个平台形态", stat3: "个 Coze 智能体",
      cta1: "看作品", cta2: "GitHub 主页",
    },
    method: {
      eyebrow: "工作方法", title: "AI 原生的产品交付流程",
      s1t: "从用户场景出发写 PRD",
      s1d: "先定义问题和边界：用户是谁、痛点是什么、P0/P1/P2 怎么划。文献阅读器项目直接产出了 1.9 万字 PRD。",
      s2t: "AI 结对，我来架构与验收",
      s2d: "Codex / Cursor / WorkBuddy / Claude 写代码，我做技术选型、安全边界设计（密钥不进前端）、结果验收。人机分工明确。",
      s3t: "最快路径部署上线",
      s3d: "CloudBase 静态托管、GitHub Pages、微信开发者工具真机验证——能上线就不停在 demo。",
      s4t: "诚实度量，快速迭代",
      s4d: "自检脚本回归、模拟器 + 真机双验证；每个 README 如实标注「已验证 / 待开发」的边界——对用户诚实，也是对产品诚实。",
    },
    story: {
      eyebrow: "主线产品",
      title: "「智慧识别」：一个需求的四代演进",
      desc: "普通人查法条这件事，我做了四代：从数据地基，到网站，到小程序，再到接入大模型。每一代解决上一代的真实短板。",
      v0t: "数据地基 · Python 流水线",
      v0d: "裁判文书和法规都是非结构化长文本。先写流水线把「案例 × 法条」关联结构化，产出 Excel 数据表——检索产品先要有可检索的数据。",
      v1t: "网站版 · 规则引擎，已部署",
      v1d: "大白话输入 → 相关度排序 → 智能分析报告（风险提示 / 证据清单 / 诉讼时效检测）。108 条条文 + 25 个纠纷场景，纯静态零成本部署 CloudBase。",
      v1xt: "小程序版 · 双端复用",
      v1xd: "用户在微信里，不在浏览器里。数据层、检索算法、分析规则三同源迁移，一次设计两端交付，7 个页面。",
      v2t: "LLM 版 · 可控地引入大模型",
      v2d: "关键词召回追不上用户问法，引入 DeepSeek——但密钥绝不进前端、司法解释文号与效力状态用结构化库召回而非让模型编造。哪些不交给模型，是产品决策。",
    },
    proj: { eyebrow: "全部作品", title: "项目作品集", demoBtn: "体验 Demo", prdBtn: "阅读 PRD" },
    coze: {
      eyebrow: "Agent 能力", title: "Coze 智能体系列",
      desc: "发布在扣子商店的三个智能体——点击「体验 Demo」，无需跳转即可在本站直接对话试用。",
      demoBtn: "体验 Demo", storeBtn: "商店主页",
      demoOpen: "新窗口打开 ↗", demoLoading: "正在加载智能体…",
      demoHint: "首次加载可能稍慢；如无法显示，请点「新窗口打开」。",
    },
    about: {
      eyebrow: "关于我", title: "产品经理 × AI 原生",
      a1t: "产品能力",
      a1l1: "产品文档：PRD / 用户场景 / 竞品分析 / P0-P2 范围管理",
      a1l2: "数据思维：Python 数据流水线 / Tableau 可视化",
      a1l3: "原型能力：Axure 交互原型 / 前端可运行原型",
      a2t: "AI 工具链",
      a2l1: "智能体搭建：Coze（Bot / 工作流 / 发布上架）",
      a2l2: "AI 编码：Codex / Cursor / Claude Code / WorkBuddy",
      a2l3: "模型集成：DeepSeek 等 OpenAI 兼容 API / RAG 检索设计",
      a3t: "产品信念",
      a3l1: "能上线的产品 > 完美的文档",
      a3l2: "AI 放大判断力，不能替代判断力——边界设计是产品人的事",
      a3l3: "诚实标注能力边界，是最被低估的产品价值",
    },
    footer: { text: "© 2026 · 用 AI 构建，也构建 AI 产品 · 源码见各项目仓库" },
  },

  en: {
    hero: {
      eyebrow: "AI Product Manager · AI-Native Workflow",
      title: "Turning ideas into<br/><em>shipped products</em> with AI",
      sub: "I don't just write PRDs — user scenarios, product docs, data pipelines, full-stack builds and deployment, all delivered with an AI toolchain. This is my complete body of work.",
      stat1: "shipped products", stat2: "platforms", stat3: "Coze agents",
      cta1: "View work", cta2: "GitHub profile",
    },
    method: {
      eyebrow: "Method", title: "An AI-native product delivery loop",
      s1t: "PRD-first, from user scenarios",
      s1d: "Define the problem and its boundaries first: who, what pain, P0/P1/P2 scoping. The literature reader project produced a 19,000-word PRD before a single line of code.",
      s2t: "AI pair-builds; I architect & verify",
      s2d: "Codex / Cursor / WorkBuddy / Claude write code. I own tech choices, security boundaries (never keys in frontend), and acceptance. Clear human-machine division of labor.",
      s3t: "Ship via the fastest path",
      s3d: "CloudBase static hosting, GitHub Pages, WeChat DevTools device preview — if it can go live, it doesn't stay a demo.",
      s4t: "Honest metrics, fast iteration",
      s4d: "Self-check scripts, simulator + real-device verification. Every README honestly marks verified vs. pending — honesty with users is honesty with the product.",
    },
    story: {
      eyebrow: "Flagship",
      title: "\u201cSmart Legal ID\u201d: four generations of one need",
      desc: "Helping ordinary people find the law — four generations: data foundation, web app, mini program, then LLM. Each generation fixed the previous one's real weakness.",
      v0t: "v0 · Data foundation (Python)",
      v0d: "Judgments and statutes are unstructured long text. First build a pipeline structuring case × provision links into Excel — a search product needs searchable data first.",
      v1t: "v1 · Web app, rule engine, deployed",
      v1d: "Plain-language input → ranked results → analysis reports (risk alerts / evidence checklists / statute-of-limitations detection). 108 provisions, 25 dispute scenarios, static hosting on CloudBase.",
      v1xt: "v1.x · Mini program, dual-platform reuse",
      v1xd: "Users live in WeChat, not browsers. Data layer, search algorithm and analysis rules migrated from the same source — designed once, delivered twice, 7 pages.",
      v2t: "v2 · LLM edition, controlled AI",
      v2d: "Keyword recall can't keep up with user phrasing; added DeepSeek — but keys never enter the frontend, and judicial interpretation numbers/status are recalled from a structured library, not model-generated. What NOT to delegate to the model is a product decision.",
    },
    proj: { eyebrow: "All work", title: "Project portfolio", demoBtn: "Try demo", prdBtn: "Read PRD" },
    coze: {
      eyebrow: "Agent skills", title: "Coze agent series",
      desc: "Three agents published on the Coze store — hit \u201cTry demo\u201d to chat with them right here on this site.",
      demoBtn: "Try demo", storeBtn: "Store page",
      demoOpen: "Open in new tab ↗", demoLoading: "Loading agent…",
      demoHint: "First load may take a moment. If it doesn't render, use \u201cOpen in new tab\u201d.",
    },
    about: {
      eyebrow: "About", title: "PM × AI-native",
      a1t: "Product craft",
      a1l1: "Docs: PRDs / user scenarios / competitive analysis / P0-P2 scoping",
      a1l2: "Data: Python pipelines / Tableau visualization",
      a1l3: "Prototyping: Axure interactive / runnable front-end prototypes",
      a2t: "AI toolchain",
      a2l1: "Agents: Coze (bots / workflows / store publishing)",
      a2l2: "AI coding: Codex / Cursor / Claude Code / WorkBuddy",
      a2l3: "Model integration: DeepSeek & OpenAI-compatible APIs / RAG design",
      a3t: "Product beliefs",
      a3l1: "A shipped product beats a perfect document",
      a3l2: "AI amplifies judgment but doesn't replace it — boundary design is the PM's job",
      a3l3: "Honestly marking capability limits is the most underrated product value",
    },
    footer: { text: "© 2026 · Built with AI, building AI products · Source code in each repo" },
  },

  /* ---- 项目卡片（双语字段并列） ---- */
  projects: [
    {
      tags: ["Web", { zh: "已部署", en: "Deployed", cls: "tag-live" }],
      title: { zh: "智慧识别 · AI 法律检索与分析网站", en: "Smart Legal ID · AI law search & analysis" },
      desc: { zh: "大白话查法条 + 智能分析报告。108 条民法典条文、25 个纠纷场景规则引擎，零依赖纯静态，含 SSRF 防护的云服务器版与自检脚本。",
              en: "Plain-language legal search with analysis reports. 108 civil-code provisions, 25 scenario rules, zero-dependency static build, SSRF-guarded server & self-check script." },
      tools: "HTML/JS · CloudBase",
      link: "https://github.com/lemon150637/ai-law-search-web",
      demo: "demo/law-search/index.html",
      demoEmoji: "⚖",
    },
    {
      tags: ["WeChat", { zh: "双端复用", en: "Dual-platform", cls: "" }],
      title: { zh: "智慧识别 · 微信小程序版", en: "Smart Legal ID · WeChat Mini Program" },
      desc: { zh: "与网站版共享同一套数据、检索与分析引擎，一次设计两端交付。7 页面 41 文件：检索 / 分析 / 收藏 / 历史 / 数据接入。",
              en: "Shares data, search & analysis engines with the web version. Designed once, delivered twice. 7 pages: search / analysis / favorites / history / data import." },
      tools: "WXML/WXSS · DevTools",
      link: "https://github.com/lemon150637/ai-law-search-miniapp",
    },
    {
      tags: ["LLM", { zh: "迭代中", en: "In iteration", cls: "tag-wip" }],
      title: { zh: "法条智检 · LLM 增强版小程序", en: "Law Check · LLM-enhanced mini program" },
      desc: { zh: "可控引入 DeepSeek：密钥只留在服务端、司法解释走结构化召回不让模型编造、后端负责鉴权限流。下一代检索架构在 roadmap 里。",
              en: "Controlled DeepSeek integration: keys server-side only, judicial interpretations recalled from structured data, backend handles auth & rate-limiting." },
      tools: "Node · DeepSeek API",
      link: "https://github.com/lemon150637/ai-law-llm-miniapp",
    },
    {
      tags: [{ zh: "PRD 驱动", en: "PRD-driven", cls: "tag-live" }, "AGPL"],
      title: { zh: "个人法学文献阅读器", en: "Personal legal literature reader" },
      desc: { zh: "从 1.9 万字 PRD 出发，基于 Koodo Reader 二次开发：新增论文元数据面板（期刊/DOI/方法/结论）、独立存储、Markdown 导出，最小侵入上游。",
              en: "Started from a 19k-word PRD; built on Koodo Reader with minimal invasiveness: paper metadata panel (journal/DOI/method), isolated storage, Markdown export." },
      tools: "React · localforage",
      link: "https://github.com/lemon150637/personal-literature-reader",
      demo: "demo/prd/index.html",
      demoEmoji: "读",
      demoKind: "prd",
    },
    {
      tags: ["React", { zh: "原型", en: "Prototype", cls: "tag-wip" }],
      title: { zh: "知序 · 研究文献工作台原型", en: "ZhiXu · research workbench prototype" },
      desc: { zh: "PRD 的快速验证原型：文献库 + 可溯源问答助手。默认无密钥本地检索可玩，接真实模型时只上传问题 + 最多 8 条片段，回答必须引用来源编号。",
              en: "Rapid PRD validation: library + traceable Q&A. Runs keyless with local search by default; real-model mode uploads only the question + 8 snippets, answers must cite sources." },
      tools: "React · Vite · Node",
      link: "https://github.com/lemon150637/literature-workbench-react",
      demo: "demo/workbench/index.html",
      demoEmoji: "序",
    },
    {
      tags: ["Python", { zh: "数据流水线", en: "Data pipeline", cls: "" }],
      title: { zh: "法条依据结构化数据流水线", en: "Law provision structuring pipeline" },
      desc: { zh: "把裁判文书与法规原文变成结构化数据：抓取 → 清洗 → 条文切分 → 案例法条关联 → Excel 交付。检索产品的数据地基，多版本迭代痕迹完整保留。",
              en: "Turns judgments and statutes into structured data: fetch → clean → segment → link cases to provisions → Excel. The data foundation under the search products." },
      tools: "Python · openpyxl",
      link: "https://github.com/lemon150637/law-clause-pipeline",
    },
  ],

  /* ---- Coze 智能体（扣子商店已发布，链接为真实分享链接） ---- */
  cozeAgents: [
    {
      emoji: "獬",
      title: "獬豸老师",
      role: { zh: "法学学习智能体", en: "Legal studies tutor" },
      desc: { zh: "以明辨是非的法治神兽「獬豸」为名，面向法学学习者：法条讲解、案例拆解、考点问答。", en: "Named after Xiezhi, the justice beast — law explanation, case breakdown and exam Q&A for law learners." },
      link: "https://www.coze.cn/s/8H5nVLDk4gU/",
    },
    {
      emoji: "办",
      title: "清小办",
      role: { zh: "办公事务智能体", en: "Office assistant" },
      desc: { zh: "日常办公场景的效率助手：文书起草、流程指引、事务整理。", en: "An efficiency assistant for daily office work: drafting, process guidance and task organization." },
      link: "https://www.coze.cn/s/spaUt7pECxA/",
    },
    {
      emoji: "职",
      title: "清小职",
      role: { zh: "求职成长智能体", en: "Career assistant" },
      desc: { zh: "面向求职者的成长伙伴：简历打磨、面试模拟、职业规划建议。", en: "A career companion: resume polishing, mock interviews and growth planning." },
      link: "https://www.coze.cn/s/fxM8vv2DGKM/",
    },
  ],
};

/* ============ 渲染 ============ */

function renderProjects(lang) {
  const dict = DATA[lang].proj;
  const grid = document.getElementById("projGrid");
  grid.innerHTML = DATA.projects.map(p => {
    const tags = p.tags.map(t => {
      if (typeof t === "string") return `<span class="tag">${t}</span>`;
      return `<span class="tag ${t.cls || ""}">${t[lang]}</span>`;
    }).join("");
    const demoBtn = p.demo ? `
      <button class="proj-demo" type="button"
        data-demo="${p.demo}"
        data-demo-title="${p.title[lang]}"
        data-demo-emoji="${p.demoEmoji || "▶"}"
        data-demo-open="${p.demo}">${dict[p.demoKind === "prd" ? "prdBtn" : "demoBtn"]}</button>` : "";
    return `
      <article class="proj-card">
        <div class="proj-tags">${tags}</div>
        <h3>${p.title[lang]}</h3>
        <p class="desc">${p.desc[lang]}</p>
        <div class="proj-meta">
          <span class="tools">${p.tools}</span>
          <span class="proj-meta-right">${demoBtn}<a class="proj-link" href="${p.link}" target="_blank" rel="noopener">GitHub →</a></span>
        </div>
      </article>`;
  }).join("");
}

function renderCoze(lang) {
  const dict = DATA[lang].coze;
  const grid = document.getElementById("cozeGrid");
  grid.innerHTML = DATA.cozeAgents.map(a => `
    <article class="coze-card">
      <div class="coze-avatar">${a.emoji}</div>
      <h3>${a.title}</h3>
      <p class="role">${a.role[lang]}</p>
      <p class="desc">${a.desc[lang]}</p>
      <div class="coze-actions">
        <button class="coze-btn coze-btn-demo" type="button"
          data-demo="${a.link}"
          data-demo-title="${a.title}"
          data-demo-emoji="${a.emoji}"
          data-demo-open="${a.link}">${dict.demoBtn}</button>
        <a class="coze-btn" href="${a.link}" target="_blank" rel="noopener">${dict.storeBtn}</a>
      </div>
    </article>`).join("");
}

/* ============ 通用 Demo 模态框（Coze 智能体 / 项目 Demo / PRD 共用） ============ */

const demoModal = document.getElementById("demoModal");
const demoFrame = document.getElementById("demoFrame");
const demoLoading = document.getElementById("demoLoading");
let demoTimer = null;

function openDemo(demo) {
  document.getElementById("demoEmoji").textContent = demo.emoji;
  document.getElementById("demoTitle").textContent = demo.title;
  document.getElementById("demoOpen").href = demo.open;
  demoFrame.src = demo.url;
  demoLoading.style.display = "flex";
  demoModal.hidden = false;
  document.body.style.overflow = "hidden";
  clearTimeout(demoTimer);
  /* 兜底：9 秒后无论如何撤掉 loading（跨域 iframe 加载失败无法感知） */
  demoTimer = setTimeout(() => { demoLoading.style.display = "none"; }, 9000);
}

function closeDemo() {
  demoModal.hidden = true;
  demoFrame.src = "about:blank";
  document.body.style.overflow = "";
  clearTimeout(demoTimer);
}

demoFrame.addEventListener("load", () => { demoLoading.style.display = "none"; });
document.getElementById("demoClose").addEventListener("click", closeDemo);
demoModal.addEventListener("click", e => { if (e.target === demoModal) closeDemo(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !demoModal.hidden) closeDemo(); });
document.addEventListener("click", e => {
  const btn = e.target.closest("[data-demo]");
  if (!btn || !btn.dataset.demo) return;
  openDemo({
    url: btn.dataset.demo,
    title: btn.dataset.demoTitle || "Demo",
    emoji: btn.dataset.demoEmoji || "▶",
    open: btn.dataset.demoOpen || btn.dataset.demo,
  });
});

/* ============ i18n ============ */

function applyLang(lang) {
  const dict = DATA[lang];
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const path = el.getAttribute("data-i18n").split(".");
    let val = dict;
    for (const key of path) val = val[key];
    if (val !== undefined) el.innerHTML = val;
  });
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  document.title = lang === "zh"
    ? "AI Product Builder · 作品集"
    : "AI Product Builder · Portfolio";
  document.getElementById("langToggle").textContent = lang === "zh" ? "EN" : "中文";
  renderProjects(lang);
  renderCoze(lang);
  localStorage.setItem("portfolio-lang", lang);
}

document.getElementById("langToggle").addEventListener("click", () => {
  const current = localStorage.getItem("portfolio-lang") || "zh";
  applyLang(current === "zh" ? "en" : "zh");
});

/* 启动：默认中文 */
applyLang(localStorage.getItem("portfolio-lang") || "zh");
