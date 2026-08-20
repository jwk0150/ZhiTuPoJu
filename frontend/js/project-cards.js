// Scene2：关于我们六大模块 · 专业简介浮层
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
    roleLabel: "看见分布",
    accent: "#ecc984",
    icon: ICONS.map,
    summary: "把招聘数据落到省—市尺度，对照本地岗位密度、薪资与技能结构，让区域人才供需一眼可读。",
    background: "面向评委、用人单位与区域研究场景：先建立可核对的空间底图，再下钻到城市热门岗位与能力缺口，避免只谈全国均值。",
    features: ["省—市下钻对照", "岗位密度与薪资"],
    role: ["高校与研究机构", "人社 / 产业园区", "用人单位与咨询方"],
    tech: ["ECharts", "GeoJSON", "PostGIS", "PostgreSQL", "热力层", "区域筛选"]
  },
  {
    id: "job-insight",
    title: "岗位洞察",
    type: "能力演化 · 宏观趋势",
    roleLabel: "读懂变化",
    accent: "#ecc984",
    icon: ICONS.insight,
    summary: "对同一岗位做技能时序差分，标出新增、消退与结构调整，把“岗位在变什么”说清楚。",
    background: "技术栈迁移会重写岗位说明书。本模块以图谱关系与招聘文本为证据，输出可解释的能力演化轨迹与学习路径入口。",
    features: ["技能时序差分", "趋势与学习路径"],
    role: ["培养方案设计者", "职业发展顾问", "企业 HR / 培训负责人"],
    tech: ["Neo4j", "时序差分", "ECharts", "技能热度", "路径推荐", "趋势对照"]
  },
  {
    id: "job-discovery",
    title: "新岗位发现",
    type: "多源文本 · 岗位识别",
    roleLabel: "发现新岗",
    accent: "#ecc984",
    icon: ICONS.discovery,
    summary: "从多源招聘与行业材料中识别正在成形的岗位实体，整理为可修订的标准定义与时间线。",
    background: "新兴岗位往往先出现在散落文本里，而不是目录表。本模块抽取职责与名称变体，并保留出处，便于评审与后续入库。",
    features: ["新兴岗位抽取", "定义与时间线"],
    role: ["产业研究与政策团队", "高校专业建设", "人才市场分析"],
    tech: ["Scrapy", "Playwright", "HanLP", "PostgreSQL", "文本去重", "实体归一"]
  },
  {
    id: "job-match",
    title: "人岗匹配",
    type: "简历解析 · 差距诊断",
    roleLabel: "对照人岗",
    accent: "#ecc984",
    icon: ICONS.match,
    summary: "将简历技能与岗位要求放到同一套图谱语言中对照，给出匹配分、证据链与可执行补齐建议。",
    background: "关键词对不上，不等于能力对不上。本模块强调可解释匹配：分项证据、差距清单与就业指导入口一体呈现。",
    features: ["可解释匹配分", "差距与补齐建议"],
    role: ["求职者与在校生", "就业指导老师", "招聘与人才评估"],
    tech: ["OCR", "图谱路径", "语义相似", "技能词典", "证据回链", "指导接口"]
  },
  {
    id: "smart-qa",
    title: "智能问答",
    type: "图谱检索 · RAG",
    roleLabel: "问清图谱",
    accent: "#ecc984",
    icon: ICONS.qa,
    summary: "用自然语言查询岗位、技能与匹配关系，结合图谱检索与来源片段给出可核对答复。",
    background: "路演与日常使用都需要“一句话问清楚”。问答挂在工作台侧栏，回答绑定出处，避免空泛生成。",
    features: ["自然语言查询", "出处可回溯"],
    role: ["演示与答辩场景", "业务咨询与客服支撑", "内部知识检索"],
    tech: ["DeepSeek", "RAG", "Neo4j", "向量检索", "来源片段", "侧栏唤起"]
  },
  {
    id: "data-base",
    title: "数据底座",
    type: "采集治理 · 质量监控",
    roleLabel: "守住数据",
    accent: "#ecc984",
    icon: ICONS.data,
    summary: "汇聚多源招聘与行业文本，完成清洗、去重与质量看板，为上层地图与洞察提供可审计底数。",
    background: "上层分析可信度取决于底座。本模块负责采集任务启停、完整性与合格率监控，保证结果可复核。",
    features: ["多源采集清洗", "质量看板监控"],
    role: ["数据工程与运维", "产品与算法协同", "审计与合规查阅"],
    tech: ["Scrapy", "Playwright", "PostgreSQL", "去重校验", "合格率", "任务告警"]
  }
];

const aboutProjects = projects;

let activeProject = null;
let isAnimating = false;
let modalElements = {};
let openTimeline = null;
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    demo: document.getElementById("projectModalDemo")
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
        <article class="project-card atlas-plate" data-project-id="${project.id}" style="--d:${0.16 + index * 0.07}s" aria-label="查看${project.title}简介">
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
  modalElements.demo?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    forceCloseProjectModal();
    document.querySelector("[data-go-login]")?.click();
  });
  modalElements.card.addEventListener("click", (event) => event.stopPropagation());
  modalElements.card.addEventListener("wheel", (event) => event.stopPropagation(), { passive: true });
  modalElements.card.addEventListener("touchstart", (event) => event.stopPropagation(), { passive: true });
  modalElements.card.addEventListener("touchend", (event) => event.stopPropagation(), { passive: true });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeProject) closeProjectModal();
  });
}

function handleCardClick(event) {
  event.preventDefault();
  event.stopPropagation();
  const card = event.currentTarget.closest?.(".project-card") || event.target.closest(".project-card");
  const id = card?.dataset.projectId;
  const project = aboutProjects.find((item) => item.id === id);
  if (!project || isAnimating) return;
  openProjectModal(project);
}

function contentTargets() {
  return [
    modalElements.type,
    modalElements.title,
    modalElements.summary,
    ...modalElements.card.querySelectorAll(".project-detail-section"),
    ...modalElements.card.querySelectorAll(".project-modal-actions > *"),
    modalElements.media?.querySelector(".project-modal-orb")
  ].filter(Boolean);
}

function playOpenChoreography(project) {
  if (openTimeline) {
    openTimeline.kill();
    openTimeline = null;
  }

  const targets = contentTargets();
  const orb = modalElements.media?.querySelector(".project-modal-orb");

  if (reduceMotion() || typeof gsap === "undefined") {
    targets.forEach((el) => {
      el.style.opacity = "1";
      el.style.transform = "none";
      el.style.filter = "none";
    });
    if (modalElements.summary) modalElements.summary.textContent = project.summary;
    return;
  }

  if (typeof TextPlugin !== "undefined") {
    gsap.registerPlugin(TextPlugin);
  }

  gsap.set(targets, { opacity: 0, y: 22, filter: "blur(6px)" });
  if (orb) gsap.set(orb, { scale: 0.92 });

  openTimeline = gsap.timeline({
    defaults: { ease: "power3.out" }
  });

  openTimeline
    .to(modalElements.card, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.85,
      ease: "expo.out"
    }, 0)
    .to(orb, { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.9 }, 0.08)
    .to(modalElements.type, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.55 }, 0.16)
    .to(modalElements.title, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7 }, 0.24);

  if (typeof TextPlugin !== "undefined" && modalElements.summary) {
    modalElements.summary.textContent = "";
    openTimeline.to(modalElements.summary, {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      duration: 0.35
    }, 0.34);
    openTimeline.to(modalElements.summary, {
      duration: Math.min(1.35, 0.45 + project.summary.length * 0.018),
      text: project.summary,
      ease: "none"
    }, 0.38);
  } else if (modalElements.summary) {
    modalElements.summary.textContent = project.summary;
    openTimeline.to(modalElements.summary, {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      duration: 0.6
    }, 0.34);
  }

  openTimeline.to(
    modalElements.card.querySelectorAll(".project-detail-section"),
    { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.58, stagger: 0.08 },
    0.52
  );
  openTimeline.to(
    modalElements.card.querySelectorAll(".project-modal-actions > *"),
    { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.5, stagger: 0.06 },
    0.78
  );
  openTimeline.call(() => {
    isAnimating = false;
    if (orb) {
      gsap.to(orb, {
        y: -4,
        duration: 2.4,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1
      });
    }
  });
}

function openProjectModal(project) {
  isAnimating = true;
  activeProject = project;
  renderProject(project);

  document.body.classList.add("project-detail-open");
  modalElements.overlay.style.display = "grid";
  modalElements.overlay.setAttribute("aria-hidden", "false");
  modalElements.card.scrollTop = 0;

  if (typeof gsap !== "undefined") {
    gsap.set(modalElements.card, { opacity: 0, y: 18, scale: 0.97 });
  }

  requestAnimationFrame(() => {
    modalElements.overlay.classList.add("is-open");
    modalElements.card.focus({ preventScroll: true });
    playOpenChoreography(project);
  });

  if (reduceMotion() || typeof gsap === "undefined") {
    setTimeout(() => {
      isAnimating = false;
    }, 360);
  }
}

function closeProjectModal() {
  if (!activeProject) return;
  if (isAnimating) {
    // allow close once content has rendered; force if still entering
  }
  isAnimating = true;

  if (openTimeline) {
    openTimeline.kill();
    openTimeline = null;
  }
  const orb = modalElements.media?.querySelector(".project-modal-orb");
  if (typeof gsap !== "undefined") {
    if (orb) gsap.killTweensOf(orb);
    gsap.killTweensOf(contentTargets());
  }

  const finish = () => {
    modalElements.overlay.classList.remove("is-closing");
    modalElements.overlay.style.display = "none";
    modalElements.overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("project-detail-open");
    activeProject = null;
    isAnimating = false;
  };

  modalElements.overlay.classList.remove("is-open");
  modalElements.overlay.classList.add("is-closing");

  if (typeof gsap !== "undefined" && !reduceMotion()) {
    gsap.to(modalElements.card, {
      opacity: 0,
      y: 12,
      scale: 0.98,
      duration: 0.28,
      ease: "power2.in",
      onComplete: finish
    });
    return;
  }

  setTimeout(finish, 280);
}

function forceCloseProjectModal() {
  if (openTimeline) {
    openTimeline.kill();
    openTimeline = null;
  }
  if (typeof gsap !== "undefined") {
    gsap.killTweensOf(modalElements.card);
    gsap.killTweensOf(contentTargets());
  }
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
  modalElements.background.textContent = project.background;
  if (modalElements.demo) {
    modalElements.demo.textContent = "登录体验";
    modalElements.demo.classList.remove("is-disabled");
    modalElements.demo.removeAttribute("aria-disabled");
  }
  renderMedia(project);
  renderList(modalElements.features, project.features);
  renderList(modalElements.role, project.role);
  renderTech(project.tech);
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
