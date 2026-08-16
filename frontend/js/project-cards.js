// Scene2 project cards and detail overlay. Add new projects by appending here.
const projects = [
  {
    id: "job-discovery",
    title: "新岗位发现与定义",
    type: "AI · 多源异构数据 · 岗位挖掘",
    description: "从多源异构数据中识别新兴岗位，生成岗位定义，支持人工优化与动态更新。",
    summary: "从多源异构数据中自动识别新兴岗位，并生成结构化岗位定义。",
    background: "数字经济快速发展，技术迭代速度远超人才培养周期。企业在新兴岗位上面临「招不到合适的人」的困境，传统关键词匹配缺乏对技术趋势的实时感知能力。本模块结合多源数据采集与讯飞星火大模型，自动挖掘并定义新型岗位。",
    features: [
      "多源数据采集（招聘网站/行业报告/社交媒体）",
      "大模型驱动的岗位实体识别",
      "岗位定义结构化生成（名称/职责/必备技能/加分技能/行业场景）",
      "人工反馈闭环与动态更新",
      "岗位生命周期可视化追踪"
    ],
    role: ["数据工程师", "后端/AI 工程师", "前端工程师"],
    tech: ["Scrapy", "Playwright", "讯飞星火 X2", "HanLP", "Neo4j", "PostgreSQL"],
    tags: ["AI", "KG", "Job Mining"],
    status: "核心功能",
    image: "assets/projects/project1.svg",
    demoUrl: "",
    githubUrl: "",
    demoAvailable: false,
    githubPublic: false
  },
  {
    id: "ability-evolution",
    title: "既有岗位能力动态更新",
    type: "知识图谱 · 动态演化分析",
    description: "追踪现有岗位（如 Java 开发工程师）能力变化，标注新增/删除/修改项。",
    summary: "追踪现有岗位的能力变化，并提供完整的版本化与数据溯源。",
    background: "现有岗位的能力要求并非一成不变。以 Java 开发工程师为例，从 Spring Boot 到 Spring AI、从单体架构到云原生，能力要求快速演化。本模块基于时序图谱实现能力演化的精细追踪。",
    features: [
      "时序数据管理与数据版本化",
      "新增/删除/修改能力自动识别",
      "数据源溯源（提供原始 JD 佐证）",
      "NetworkX 图算法（中心性/社区发现）",
      "能力变化事件流与时间线展示"
    ],
    role: ["数据工程师", "后端/AI 工程师"],
    tech: ["NetworkX", "Neo4j", "Pandas", "时序分析", "Python"],
    tags: ["KG", "Evolution", "Time-Series"],
    status: "核心功能",
    image: "assets/projects/project2.svg",
    demoUrl: "",
    githubUrl: "",
    demoAvailable: false,
    githubPublic: false
  },
  {
    id: "graph-visualize",
    title: "全景图谱可视化",
    type: "图谱可视化 · AntV G6",
    description: "技能点级别粒度，支持按技术栈与级别切换视图，呈现岗位-技能-行业全链路。",
    summary: "技能点级别粒度的全景图谱可视化，支持多维度切换视图。",
    background: "传统知识图谱可视化通常停留在岗位级别，难以呈现细粒度的技能关系。本模块基于 AntV G6 实现技能点级别粒度的高性能图谱渲染，支持多种交互模式。",
    features: [
      "技能点级别粒度图谱渲染",
      "按技术栈切换视图（前端/后端/AI/数据等）",
      "按级别筛选（初级/中级/高级）",
      "节点拖拽、缩放、聚焦交互",
      "岗位-技能-行业全链路关系展示"
    ],
    role: ["前端工程师", "UI/UX 设计"],
    tech: ["Vue 3", "AntV G6", "ECharts", "Vite", "Pinia"],
    tags: ["Visualization", "AntV G6", "Vue 3"],
    status: "核心亮点",
    image: "assets/projects/project3.svg",
    demoUrl: "",
    githubUrl: "",
    demoAvailable: false,
    githubPublic: false
  },
  {
    id: "job-match",
    title: "人岗匹配度诊断",
    type: "RAG · 简历解析 · 智能匹配",
    description: "支持 PDF/Word 简历解析（准确率 ≥90%），多维度匹配 + 差距分析 + 学习路径规划。",
    summary: "智能简历解析与多维度人岗匹配，并给出个性化学习路径。",
    background: "传统招聘依赖关键词匹配，无法真正理解候选人能力与岗位需求。本模块结合讯飞 OCR、NER 与 RAG 技术，实现简历的结构化提取，并基于知识图谱给出多维度匹配诊断与学习路径推荐。",
    features: [
      "PDF/Word 简历解析（准确率 ≥90%）",
      "技能 NER 提取与标准化",
      "语义相似度 + 图谱路径距离融合打分",
      "多维度匹配分析 + 差距分析报告",
      "个性化学习路径推荐"
    ],
    role: ["后端/AI 工程师", "前端工程师"],
    tech: ["讯飞 OCR", "BERT-CRF", "BGE-M3", "LangChain", "ChromaDB", "FastAPI"],
    tags: ["RAG", "Matching", "Resume"],
    status: "核心亮点",
    image: "assets/projects/project4.svg",
    demoUrl: "",
    githubUrl: "",
    demoAvailable: false,
    githubPublic: false
  }
];

let activeProject = null;
let isAnimating = false;
let modalElements = {};

function initProjectCards() {
  modalElements = {
    overlay: document.getElementById("projectModal"),
    backdrop: document.getElementById("projectModalBackdrop") || document.querySelector(".project-modal-backdrop"),
    card: document.getElementById("projectModalCard"),
    closeBtn: document.getElementById("projectModalClose"),
    closeTextBtn: document.getElementById("projectModalCloseText"),
    media: document.getElementById("projectModalMedia"),
    type: document.getElementById("projectModalType"),
    title: document.getElementById("projectModalTitle"),
    summary: document.getElementById("projectModalSummary"),
    background: document.getElementById("projectModalBackground"),
    features: document.getElementById("projectModalFeatures"),
    role: document.getElementById("projectModalRole"),
    tech: document.getElementById("projectModalTech"),
    status: document.getElementById("projectModalStatus"),
    demo: document.getElementById("projectModalDemo"),
    github: document.getElementById("projectModalGithub")
  };

  if (!modalElements.overlay || !modalElements.card) return;

  if (modalElements.overlay.parentElement !== document.body) {
    document.body.appendChild(modalElements.overlay);
  }

  renderProjectCards();
  bindCardEvents();
  bindModalEvents();
}

function renderProjectCards() {
  const grid = document.querySelector(".project-cards-grid");
  if (!grid) return;

  grid.innerHTML = projects.map((project) => `
    <article class="project-card" data-project-id="${project.id}">
      <div class="project-image-wrap">
        <img class="project-card-image" src="${project.image}" alt="${project.title}">
      </div>
      <div class="project-card-info">
        <h3 class="project-card-title">${project.title}</h3>
        <p class="project-card-description">${project.description}</p>
        <div class="project-tags">
          ${project.tags.map((tag) => `<span>${tag}</span>`).join("")}
        </div>
      </div>
    </article>
  `).join("");
}

function bindCardEvents() {
  document.querySelectorAll(".project-card").forEach((card) => {
    card.addEventListener("click", handleCardClick);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleCardClick(event);
      }
    });
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-haspopup", "dialog");
  });
}

function bindModalEvents() {
  modalElements.backdrop?.addEventListener("click", closeProjectModal);
  modalElements.closeBtn?.addEventListener("click", closeProjectModal);
  modalElements.closeTextBtn?.addEventListener("click", closeProjectModal);
  modalElements.demo?.addEventListener("click", handlePlaceholderLink);
  modalElements.github?.addEventListener("click", handlePlaceholderLink);
  modalElements.card.addEventListener("click", (event) => event.stopPropagation());
  modalElements.card.addEventListener("wheel", (event) => event.stopPropagation(), { passive: true });
  modalElements.card.addEventListener("touchstart", (event) => event.stopPropagation(), { passive: true });
  modalElements.card.addEventListener("touchend", (event) => event.stopPropagation(), { passive: true });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeProject) closeProjectModal();
  });
}

function handlePlaceholderLink(event) {
  const target = event.currentTarget;
  const href = target.getAttribute("href");
  if (target.classList.contains("is-disabled") || target.getAttribute("aria-disabled") === "true" || !href || href === "#") {
    event.preventDefault();
  }
}

function handleCardClick(event) {
  if (isAnimating || activeProject) return;
  const project = projects.find((item) => item.id === String(event.currentTarget.dataset.projectId));
  if (!project) return;
  openProjectModal(project);
}

function openProjectModal(project) {
  isAnimating = true;
  activeProject = project;
  renderProject(project);

  document.body.classList.add("project-detail-open");
  modalElements.overlay.style.display = "grid";
  modalElements.overlay.setAttribute("aria-hidden", "false");
  modalElements.card.scrollTop = 0;

  requestAnimationFrame(() => {
    modalElements.overlay.classList.add("is-open");
    modalElements.card.focus({ preventScroll: true });
  });

  setTimeout(() => {
    isAnimating = false;
  }, 360);
}

function closeProjectModal() {
  if (isAnimating || !activeProject) return;
  isAnimating = true;
  modalElements.overlay.classList.remove("is-open");
  modalElements.overlay.classList.add("is-closing");

  setTimeout(() => {
    modalElements.overlay.classList.remove("is-closing");
    modalElements.overlay.style.display = "none";
    modalElements.overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("project-detail-open");
    activeProject = null;
    isAnimating = false;
  }, 280);
}

function forceCloseProjectModal() {
  modalElements.overlay?.classList.remove("is-open", "is-closing");
  if (modalElements.overlay) {
    modalElements.overlay.style.display = "none";
    modalElements.overlay.setAttribute("aria-hidden", "true");
  }
  document.body.classList.remove("project-detail-open");
  activeProject = null;
  isAnimating = false;
}

function renderProject(project) {
  modalElements.type.textContent = project.type;
  modalElements.title.textContent = project.title;
  modalElements.summary.textContent = project.summary;
  modalElements.background.textContent = project.background || project.description;
  modalElements.status.textContent = `Status / ${project.status}`;
  renderProjectLink(modalElements.demo, {
    isAvailable: project.demoAvailable,
    url: project.demoUrl,
    availableText: "View Demo",
    unavailableText: "Coming Soon",
  });
  renderProjectLink(modalElements.github, {
    isAvailable: project.githubPublic,
    url: project.githubUrl,
    availableText: "GitHub",
    unavailableText: "Private Repo",
  });
  renderMedia(project);
  renderList(modalElements.features, project.features);
  renderList(modalElements.role, project.role);
  renderTech(project.tech);
}

function renderProjectLink(element, { isAvailable, url, availableText, unavailableText }) {
  const canOpen = Boolean(isAvailable && url);
  element.textContent = canOpen ? availableText : unavailableText;
  element.classList.toggle("is-disabled", !canOpen);
  element.setAttribute("aria-disabled", canOpen ? "false" : "true");

  if (canOpen) {
    element.href = url;
    element.target = "_blank";
    element.rel = "noopener noreferrer";
    element.tabIndex = 0;
    return;
  }

  element.removeAttribute("href");
  element.removeAttribute("target");
  element.removeAttribute("rel");
  element.tabIndex = -1;
}

function renderMedia(project) {
  modalElements.media.textContent = "";
  if (project.video) {
    const video = document.createElement("video");
    video.src = project.video;
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = "auto";
    modalElements.media.appendChild(video);
    return;
  }

  const image = document.createElement("img");
  image.src = project.image;
  image.alt = `${project.title} preview`;
  modalElements.media.appendChild(image);
}

function renderList(container, items = []) {
  container.textContent = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    container.appendChild(li);
  });
}

function renderTech(items = []) {
  modalElements.tech.textContent = "";
  items.forEach((item) => {
    const chip = document.createElement("span");
    chip.textContent = item;
    modalElements.tech.appendChild(chip);
  });
}

window.addEventListener("scene:change", () => {
  if (activeProject) forceCloseProjectModal();
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initProjectCards);
} else {
  initProjectCards();
}
