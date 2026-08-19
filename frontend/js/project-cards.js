// Scene2：六个真实功能气泡 + 详情浮层
const ICONS = {
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>',
  insight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>',
  discovery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/><circle cx="11" cy="11" r="1.2"/><path d="M11 6.5v1.4M11 14.1v1.4M6.5 11h1.4M14.1 11h1.4"/></svg>',
  match: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  qa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/><circle cx="9.2" cy="11.5" r="0.8" fill="currentColor" stroke="none"/><circle cx="12" cy="11.5" r="0.8" fill="currentColor" stroke="none"/><circle cx="14.8" cy="11.5" r="0.8" fill="currentColor" stroke="none"/></svg>',
  data: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>'
};

const projects = [
  {
    id: "talent-map",
    title: "数字人才地图",
    type: "空间分布 · 供需对照",
    x: "18%",
    y: "22%",
    place: "top",
    align: "left",
    hover: "按区域看见人才供给与岗位需求，对照能力结构。",
    roleLabel: "看见分布",
    accent: "#38d6c5",
    icon: ICONS.map,
    description: "按省、市查看岗位与技能分布。",
    summary: "从全国落到城市，看人才与岗位在哪里、缺什么。",
    background: "评委和用人单位先要看见空间格局。本模块把招聘数据落到地图上，支持省—市下钻，并对照本地热门岗位与技能。",
    features: ["全国 / 省级 / 市级下钻", "岗位密度与薪资对照", "区域热门技能", "与筛选条件联动"],
    role: ["前端工程师", "数据工程师"],
    tech: ["ECharts", "GeoJSON", "PostgreSQL"],
    tags: ["地图", "区域", "供需"],
    status: "已实现"
  },
  {
    id: "job-insight",
    title: "岗位洞察",
    type: "能力演化 · 宏观趋势",
    x: "50%",
    y: "12%",
    place: "top",
    align: "left",
    hover: "分析岗位需求变化，识别关键能力与技能趋势。",
    roleLabel: "读懂变化",
    accent: "#38d6c5",
    icon: ICONS.insight,
    description: "追踪同一岗位技能如何随时间变化。",
    summary: "对比不同时期的岗位要求，标出技能新增、删除与调整。",
    background: "同一岗位的技能清单会随技术栈迁移。本模块做时序差分，并提供宏观趋势与学习路径入口。",
    features: ["技能新增 / 删除 / 修改", "近十二月热度", "学习路径建议", "宏观趋势对照"],
    role: ["数据工程师", "后端/AI 工程师"],
    tech: ["Neo4j", "ECharts", "时序分析"],
    tags: ["演化", "趋势", "图谱"],
    status: "已实现"
  },
  {
    id: "job-discovery",
    title: "新岗位发现",
    type: "多源文本 · 岗位识别",
    x: "82%",
    y: "22%",
    place: "top",
    align: "right",
    hover: "从招聘文本中识别正在形成的新兴岗位。",
    roleLabel: "发现新岗",
    accent: "#38d6c5",
    icon: ICONS.discovery,
    description: "从招聘文本里识别正在出现的岗位。",
    summary: "从多源招聘与行业材料中抽出新兴岗位，整理成可修订的定义。",
    background: "新技术出现后，岗位名称往往先散落在招聘文本里。本模块识别岗位实体与职责，并保留出处。",
    features: ["多源文本去重", "岗位实体抽取", "可编辑岗位定义", "出现频次与时间线"],
    role: ["数据工程师", "后端/AI 工程师"],
    tech: ["Scrapy", "Playwright", "HanLP", "PostgreSQL"],
    tags: ["发现", "文本", "岗位"],
    status: "已实现"
  },
  {
    id: "job-match",
    title: "人岗匹配",
    type: "简历解析 · 差距诊断",
    x: "18%",
    y: "78%",
    place: "bottom",
    align: "left",
    hover: "将人才画像与岗位要求对照，给出可解释的匹配依据。",
    roleLabel: "对照人岗",
    accent: "#38d6c5",
    icon: ICONS.match,
    description: "把简历和岗位放在同一套语言里对照。",
    summary: "解析简历后给出匹配分、能力差距和可执行的补齐建议。",
    background: "关键词对不上，不等于能力对不上。本模块抽取简历技能，结合图谱路径打分，并给出就业指导入口。",
    features: ["简历解析", "匹配分与证据", "差距清单", "补齐建议 / 就业指导"],
    role: ["后端/AI 工程师", "前端工程师"],
    tech: ["OCR", "图谱路径", "语义相似度"],
    tags: ["匹配", "简历", "诊断"],
    status: "已实现"
  },
  {
    id: "smart-qa",
    title: "智能问答",
    type: "图谱 · RAG",
    x: "50%",
    y: "86%",
    place: "bottom",
    align: "left",
    hover: "用自然语言查询岗位、技能与匹配关系。",
    roleLabel: "问清图谱",
    accent: "#38d6c5",
    icon: ICONS.qa,
    description: "用自然语言问岗位、技能与匹配。",
    summary: "结合知识图谱与检索，回答岗位能力、演化与匹配相关问题。",
    background: "路演和日常使用都需要一句话问清楚。问答挂在工作台侧栏，查询图谱并给出带出处的说明。",
    features: ["自然语言提问", "图谱检索", "来源片段", "工作台随时唤起"],
    role: ["后端/AI 工程师"],
    tech: ["DeepSeek", "RAG", "Neo4j"],
    tags: ["问答", "RAG", "顾问"],
    status: "已实现"
  },
  {
    id: "data-base",
    title: "数据底座",
    type: "采集 · 质量监控",
    x: "82%",
    y: "78%",
    place: "bottom",
    align: "right",
    hover: "汇聚多源招聘数据，并持续监控数据质量。",
    roleLabel: "守住数据",
    accent: "#38d6c5",
    icon: ICONS.data,
    description: "多源招聘数据汇聚，并盯质量。",
    summary: "采集招聘与行业文本，监控去重、完整性和可用率。",
    background: "地图、演化、发现都建立在可核对的数据上。本模块负责多源采集、清洗与质量看板。",
    features: ["多源采集", "去重与清洗", "质量合格率", "任务启停"],
    role: ["数据工程师"],
    tech: ["Scrapy", "Playwright", "PostgreSQL"],
    tags: ["采集", "质量", "底座"],
    status: "已实现"
  }
];

const aboutProjects = projects;

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

  grid.innerHTML = `
    <p class="about-kicker">关于我们</p>
    <div class="about-matrix">
      ${aboutProjects.map((project, index) => `
        <article class="project-card atlas-plate" data-project-id="${project.id}" style="--d:${0.16 + index * 0.07}s">
          <span class="atlas-index">${String(index + 1).padStart(2, "0")}</span>
          <span class="atlas-title">为您${project.roleLabel}</span>
          <span class="atlas-name">${project.title}</span>
        </article>
      `).join("")}
    </div>
  `;
}

function bindCardEvents() {
  const grid = document.querySelector(".project-cards-grid");
  grid?.addEventListener("pointerover", (event) => {
    const card = event.target.closest(".project-card");
    if (card) grid.dataset.active = card.dataset.projectId;
  });
  grid?.addEventListener("pointerleave", () => {
    delete grid.dataset.active;
  });

  document.querySelectorAll(".project-card").forEach((card) => {
    card.addEventListener("click", handleCardClick);
    card.addEventListener("focus", () => {
      if (grid) grid.dataset.active = card.dataset.projectId;
    });
    card.addEventListener("blur", () => {
      if (grid && grid.dataset.active === card.dataset.projectId) delete grid.dataset.active;
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleCardClick(event);
      }
    });
    card.tabIndex = 0;
    card.setAttribute("role", "button");
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
  event.preventDefault();
  event.stopPropagation();
  document.querySelector("[data-go-login]")?.click();
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
  modalElements.status.textContent = project.status;
  renderProjectLink(modalElements.demo, {
    isAvailable: false,
    url: "",
    availableText: "演示",
    unavailableText: "登录后进入"
  });
  renderProjectLink(modalElements.github, {
    isAvailable: false,
    url: "",
    availableText: "代码",
    unavailableText: "代码未公开"
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
  modalElements.media.innerHTML = `<div class="project-modal-orb" style="--accent:${project.accent}">${project.icon}<span>${project.title}</span></div>`;
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
