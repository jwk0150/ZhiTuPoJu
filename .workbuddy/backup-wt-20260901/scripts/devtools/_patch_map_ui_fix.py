# -*- coding: utf-8 -*-
from pathlib import Path

path = Path("frontend/js/pages/map.js")
text = path.read_text(encoding="utf-8")

old = """    // 构建详情HTML
    var hotStars = '';
    var hl = techDetail.hotLevel || 3;
    for (var i = 0; i < 5; i++) hotStars += '<span class="tech-detail-hot-star" style="color:' + (i < hl ? '#F59E0B' : 'rgba(0,0,0,.15)') + '">★</span>';
    
    var html = '<div class="detail-content">';
    html += '<button class="graph-btn" style="margin-bottom:12px;font-size:11px;border-color:rgba(212,175,55,.35);color:#C9A86A" onclick="window.talentRestoreProvincePanel()">← 返回岗位分析</button>';
    // 头部
    html += '<div class="tech-detail-header"><span class="tech-detail-name" style="color:var(--text-dark)">' + techName + '</span><div class="tech-detail-hot">' + hotStars + '</div></div>';
    
    // ① 技术简介
    html += '<div class="tech-detail-section"><div class="tech-detail-section-title">技术简介</div><div class="tech-detail-text" style="color:var(--text-dark-secondary)">' + (techDetail.intro || _generateTechIntro(techName)) + '</div></div>';
    
    // ② 技术用途
    html += '<div class="tech-detail-section"><div class="tech-detail-section-title">技术用途</div><div class="tech-detail-tag-list">';
    var uses = techDetail.uses && techDetail.uses.length ? techDetail.uses : ['开发', '调试', '部署', '维护', '优化'];
    uses.forEach(function(u) {
        html += '<span class="tech-detail-tag">' + u + '</span>';
    });
    html += '</div></div>';
    
    // ③ 岗位使用场景
    html += '<div class="tech-detail-section"><div class="tech-detail-section-title">岗位使用场景</div><div class="tech-detail-text" style="color:var(--text-dark-secondary)">' + (techDetail.scenarios || _generateTechScenario(techName)) + '</div></div>';
    
    // ④ 需要掌握的知识点
    html += '<div class="tech-detail-section"><div class="tech-detail-section-title">核心知识点</div><div class="tech-detail-tag-list">';
    var kps = techDetail.knowledgePoints && techDetail.knowledgePoints.length ? techDetail.knowledgePoints : ['基础语法', '核心API', '常用框架', '最佳实践', '性能优化'];
    kps.forEach(function(k) {
        html += '<span class="tech-detail-tag tech-detail-tag--kp">' + k + '</span>';
    });
    html += '</div></div>';
    
    // ⑤ 学习路径
    html += '<div class="tech-detail-section"><div class="tech-detail-section-title">学习路径建议</div><div class="tech-detail-path">';
    (techDetail.learningPath || ['入门基础', '核心应用', '项目实战', '原理深入', '架构设计']).forEach(function(p, i) {
        if (i > 0) html += '<span class="tech-detail-path-arrow">→</span>';
        html += '<span class="tech-detail-path-item">' + p + '</span>';
    });
    html += '</div></div>';
    
    // ⑥ 相关技术
    if (techDetail.relatedTech && techDetail.relatedTech.length) {
        html += '<div class="tech-detail-section"><div class="tech-detail-section-title">相关技术</div><div class="tech-detail-tag-list">';
        techDetail.relatedTech.forEach(function(r) {
            html += '<span class="tech-detail-tag" style="cursor:pointer" onclick="window.renderTechDetail(\\'' + String(r).replace(/'/g, "\\\\'") + '\\',0,0)">' + r + '</span>';
        });
        html += '</div></div>';
    }
    
    // ⑦ 数据统计（如有）
    if (techDetail.stats) {
        var st = techDetail.stats;
        html += '<div class="tech-detail-stats"><div class="tech-detail-section-title">数据统计</div>';
        if (st.jobCount > 0) {
            html += '<div class="tech-detail-stat-row"><span class="tech-detail-stat-label">需求岗位数</span><span class="tech-detail-stat-value">' + st.jobCount + '</span></div>';
            html += '<div class="tech-detail-stat-row"><span class="tech-detail-stat-label">需求占比</span><span class="tech-detail-stat-value">' + (st.jobRatio || '--') + '</span></div>';
        }
        if (st.relatedCities && st.relatedCities.length) {
            var cities = st.relatedCities.map(function(c) {
                return String(c || '').split(/[·・]/)[0].replace(/市$/, '').trim();
            }).filter(Boolean);
            var seenC = {};
            cities = cities.filter(function(c) { if (seenC[c]) return false; seenC[c] = 1; return true; }).slice(0, 6);
            if (cities.length) {
                html += '<div class="tech-detail-stat-row"><span class="tech-detail-stat-label">关联城市</span><span class="tech-detail-stat-value">' + cities.join('、') + '</span></div>';
            }
        }
        if (st.relatedJobs && st.relatedJobs.length) {
            html += '<div class="tech-detail-stat-row"><span class="tech-detail-stat-label">关联岗位</span><span class="tech-detail-stat-value tech-detail-stat-value--jobs">' + st.relatedJobs.slice(0,5).map(function(j) { return j.name; }).join('、') + '</span></div>';
        }
        html += '</div>';
    }
    
    html += '</div>';
    panel.innerHTML = html;
};"""

# Simpler: replace key low-contrast parts with regex
import re

# hot star empty color
text2 = text.replace(
    "i < hl ? '#F59E0B' : 'rgba(0,0,0,.15)'",
    "i < hl ? '#e4cfa0' : 'rgba(255,255,255,.18)'",
)

# Replace the whole block from "构建详情HTML" through panel.innerHTML using markers
start = text2.find("    // 构建详情HTML")
end = text2.find("\n};\n\n// AI兜底 - 技术简介", start)
if start < 0 or end < 0:
    raise SystemExit(f"markers missing start={start} end={end}")

new_block = r'''    // 构建详情HTML（墨金高对比：内联色，避免旧 CSS / 缓存导致紫青低可读）
    var hotStars = '';
    var hl = techDetail.hotLevel || 3;
    for (var i = 0; i < 5; i++) hotStars += '<span class="tech-detail-hot-star" style="color:' + (i < hl ? '#e4cfa0' : 'rgba(255,255,255,.18)') + '">★</span>';
    var tagGold = 'background:rgba(201,168,106,.16);color:#f0e2c0;border:1px solid rgba(201,168,106,.4)';
    var tagMint = 'background:rgba(143,168,148,.24);color:#eef3ef;border:1px solid rgba(168,184,154,.45)';
    var titleC = 'color:#c9a86a';
    var textC = 'color:#d8e2dc';

    var html = '<div class="detail-content tech-detail-ink">';
    html += '<button class="graph-btn" style="margin-bottom:12px;font-size:11px;border-color:rgba(201,168,106,.4);color:#e4cfa0;background:rgba(201,168,106,.1)" onclick="window.talentRestoreProvincePanel()">← 返回岗位分析</button>';
    html += '<div class="tech-detail-header"><span class="tech-detail-name" style="color:#eef3ef">' + techName + '</span><div class="tech-detail-hot">' + hotStars + '</div></div>';
    html += '<div class="tech-detail-section"><div class="tech-detail-section-title" style="' + titleC + '">技术简介</div><div class="tech-detail-text" style="' + textC + '">' + (techDetail.intro || _generateTechIntro(techName)) + '</div></div>';
    html += '<div class="tech-detail-section"><div class="tech-detail-section-title" style="' + titleC + '">技术用途</div><div class="tech-detail-tag-list">';
    var uses = techDetail.uses && techDetail.uses.length ? techDetail.uses : ['开发', '调试', '部署', '维护', '优化'];
    uses.forEach(function(u) { html += '<span class="tech-detail-tag" style="' + tagGold + '">' + u + '</span>'; });
    html += '</div></div>';
    html += '<div class="tech-detail-section"><div class="tech-detail-section-title" style="' + titleC + '">岗位使用场景</div><div class="tech-detail-text" style="' + textC + '">' + (techDetail.scenarios || _generateTechScenario(techName)) + '</div></div>';
    html += '<div class="tech-detail-section"><div class="tech-detail-section-title" style="' + titleC + '">核心知识点</div><div class="tech-detail-tag-list">';
    var kps = techDetail.knowledgePoints && techDetail.knowledgePoints.length ? techDetail.knowledgePoints : ['基础语法', '核心API', '常用框架', '最佳实践', '性能优化'];
    kps.forEach(function(k) { html += '<span class="tech-detail-tag tech-detail-tag--kp" style="' + tagMint + '">' + k + '</span>'; });
    html += '</div></div>';
    html += '<div class="tech-detail-section"><div class="tech-detail-section-title" style="' + titleC + '">学习路径建议</div><div class="tech-detail-path">';
    (techDetail.learningPath || ['入门基础', '核心应用', '项目实战', '原理深入', '架构设计']).forEach(function(p, i) {
        if (i > 0) html += '<span class="tech-detail-path-arrow" style="color:rgba(228,207,160,.7)">→</span>';
        html += '<span class="tech-detail-path-item" style="' + tagMint + ';padding:4px 10px;border-radius:6px">' + p + '</span>';
    });
    html += '</div></div>';
    if (techDetail.relatedTech && techDetail.relatedTech.length) {
        html += '<div class="tech-detail-section"><div class="tech-detail-section-title" style="' + titleC + '">相关技术</div><div class="tech-detail-tag-list">';
        techDetail.relatedTech.forEach(function(r) {
            html += '<span class="tech-detail-tag" style="cursor:pointer;' + tagGold + '" onclick="window.renderTechDetail(\'' + String(r).replace(/'/g, "\\'") + '\',0,0)">' + r + '</span>';
        });
        html += '</div></div>';
    }
    if (techDetail.stats) {
        var st = techDetail.stats;
        html += '<div class="tech-detail-stats" style="background:rgba(8,16,14,.55);border:1px solid rgba(201,168,106,.28);border-radius:10px;padding:12px;margin-top:16px"><div class="tech-detail-section-title" style="' + titleC + '">数据统计</div>';
        if (st.jobCount > 0) {
            html += '<div class="tech-detail-stat-row" style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.08)"><span style="color:rgba(213,224,219,.68)">需求岗位数</span><span style="color:#e4cfa0">' + st.jobCount + '</span></div>';
            html += '<div class="tech-detail-stat-row" style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.08)"><span style="color:rgba(213,224,219,.68)">需求占比</span><span style="color:#e4cfa0">' + (st.jobRatio || '--') + '</span></div>';
        }
        if (st.relatedCities && st.relatedCities.length) {
            var cities = st.relatedCities.map(function(c) {
                return String(c || '').split(/[·・]/)[0].replace(/市$/, '').trim();
            }).filter(Boolean);
            var seenC = {};
            cities = cities.filter(function(c) { if (seenC[c]) return false; seenC[c] = 1; return true; }).slice(0, 6);
            if (cities.length) {
                html += '<div class="tech-detail-stat-row" style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;align-items:flex-start"><span style="color:rgba(213,224,219,.68);flex-shrink:0">关联城市</span><span style="color:#e4cfa0;text-align:right;line-height:1.55;word-break:break-word">' + cities.join('、') + '</span></div>';
            }
        }
        if (st.relatedJobs && st.relatedJobs.length) {
            html += '<div class="tech-detail-stat-row" style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;align-items:flex-start"><span style="color:rgba(213,224,219,.68);flex-shrink:0">关联岗位</span><span style="color:#d8e2dc;font-size:12px;text-align:right;line-height:1.55;word-break:break-word">' + st.relatedJobs.slice(0,5).map(function(j) { return j.name; }).join('、') + '</span></div>';
        }
        html += '</div>';
    }
    html += '</div>';
    panel.innerHTML = html;
'''

text2 = text2[:start] + new_block + text2[end:]

# Fix ability render graph - destroy previous instance before replacing HTML
old_render = """function talentAbilityRenderGraph() {
    var st = window.talentAbilityState;
    st.mode = 'graph';
    st.editing = false;
    var body = document.getElementById('ability-modal-body');
    if (!body) return;
"""
new_render = """function talentAbilityRenderGraph() {
    var st = window.talentAbilityState;
    st.mode = 'graph';
    st.editing = false;
    if (st.graph) { try { st.graph.destroy(); } catch (e) {} st.graph = null; }
    var body = document.getElementById('ability-modal-body');
    if (!body) return;
"""
if old_render not in text2:
    raise SystemExit('talentAbilityRenderGraph header missing')
text2 = text2.replace(old_render, new_render, 1)

# After successful save, refresh categoryMap from catalog for saved items
old_save = """        st.saved = (res.data && res.data.abilities) || [];
        st.filled = !!(res.data && res.data.filled);
        window.showToast && window.showToast('能力图谱已更新', '');
        talentAbilityRenderGraph();
"""
new_save = """        st.saved = (res.data && res.data.abilities) || [];
        st.filled = !!(res.data && res.data.filled);
        if (st.catalog && st.catalog.categories) {
            st.categoryMap = st.categoryMap || {};
            st.catalog.categories.forEach(function(cat) {
                (cat.technologies || []).forEach(function(t) {
                    if (t && t.id != null) st.categoryMap[t.id] = cat.name;
                });
            });
        }
        window.showToast && window.showToast('能力图谱已更新', '');
        talentAbilityRenderGraph();
"""
if old_save not in text2:
    raise SystemExit('save success block missing')
text2 = text2.replace(old_save, new_save, 1)

# Skip chips without id
text2 = text2.replace(
    "html.push('<div class=\"ability-tech-chip\" data-id=\"' + t.id + '\" onclick=\"window.talentAbilityToggle(' + t.id + ')\">' + t.name + '</div>');",
    "if (t && t.id != null) html.push('<div class=\"ability-tech-chip\" data-id=\"' + t.id + '\" onclick=\"window.talentAbilityToggle(' + t.id + ')\">' + t.name + '</div>');",
)

path.write_text(text2, encoding="utf-8")
print("map.js patched ok")
