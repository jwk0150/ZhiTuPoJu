talentMapState = {
    dataLoaded: false,
    allProvinces: [],
    selectedProvince: null,
    hoveredProvince: null,
    hoveredCity: null,
    hoveredCityName: null,
    cityPreviewCache: {},
    selectedJob: null,
    selectedCity: null,
    mapChart: null,
    jobGraphInstance: null,
    currentLayer: 'map', // 'map' | 'province' | 'graph'
    geoJSON: null,
    defaultView: { zoom: 1.6, center: [105.5, 36.5] },
    breathTimer: null,
    mapMode: 'overview', // 'overview' = hover 悬停显示 | 'province' = 详情常驻
    isEnteringProvince: false,
    flyInSavedZoom: null,
    mapLevel: 'country',    // 'country' | 'province' | 'city'
    analysisLevel: 'country', // 'country' | 'province' | 'city' — 当前分析层级，区分省/市分析
    currentProvinceName: null,
    cityGeoJSON: null,      // 市级 GeoJSON
    cityGeoLoaded: null,    // 已加载市级的省份名称
    cityData: [],            // 市级岗位数据
    provinceDetailData: null, // 省份详情API缓存
    provinceJobs: [],        // 当前省份岗位列表
    cityDetailData: null,    // 城市详情API缓存
};

/* G6 按需加载：地图首屏只依赖 echarts，进入图谱再拉 G6 */
window.ensureG6 = function() {
    if (window.G6 && window.G6.Graph) return Promise.resolve(window.G6);
    if (window.__g6Loading) return window.__g6Loading;
    window.__g6Loading = new Promise(function(resolve, reject) {
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@antv/g6@4.8.24/dist/g6.min.js';
        s.async = true;
        s.onload = function() {
            window.__g6Loading = null;
            if (window.G6 && window.G6.Graph) resolve(window.G6);
            else reject(new Error('G6 loaded but Graph missing'));
        };
        s.onerror = function() {
            window.__g6Loading = null;
            reject(new Error('G6 CDN load failed'));
        };
        document.head.appendChild(s);
    });
    return window.__g6Loading;
};

window.destroyTalentMap = function() {
    try {
        if (talentMapState.breathTimer) {
            clearInterval(talentMapState.breathTimer);
            talentMapState.breathTimer = null;
        }
        if (talentMapState.mapChart) {
            talentMapState.mapChart.dispose();
            talentMapState.mapChart = null;
        }
        if (talentMapState.jobGraphInstance) {
            talentMapState.jobGraphInstance.destroy();
            talentMapState.jobGraphInstance = null;
        }
        if (window.talentAbilityState && window.talentAbilityState.graph) {
            try { window.talentAbilityState.graph.destroy(); } catch (e) {}
            window.talentAbilityState.graph = null;
        }
    } catch (e) {}
};

window.addEventListener('pagehide', function() {
    if (typeof window.destroyTalentMap === 'function') window.destroyTalentMap();
});

// GeoJSON 完整名 → 数据简称
const GEO_TO_SHORT = {
    '北京市':'北京','天津市':'天津','上海市':'上海','重庆市':'重庆',
    '广东省':'广东','浙江省':'浙江','江苏省':'江苏','四川省':'四川',
    '湖北省':'湖北','湖南省':'湖南','山东省':'山东','陕西省':'陕西',
    '河南省':'河南','河北省':'河北','山西省':'山西','辽宁省':'辽宁',
    '吉林省':'吉林','黑龙江省':'黑龙江','安徽省':'安徽','福建省':'福建',
    '江西省':'江西','海南省':'海南','贵州省':'贵州','云南省':'云南',
    '甘肃省':'甘肃','青海省':'青海','台湾省':'台湾',
    '广西壮族自治区':'广西','新疆维吾尔自治区':'新疆',
    '西藏自治区':'西藏','宁夏回族自治区':'宁夏',
    '内蒙古自治区':'内蒙古','香港特别行政区':'香港','澳门特别行政区':'澳门'
};
const SHORT_TO_GEO = {};
Object.entries(GEO_TO_SHORT).forEach(([k,v]) => { SHORT_TO_GEO[v] = k; });
function toShort(g) { return GEO_TO_SHORT[g] || g; }
function toGeo(s) { return SHORT_TO_GEO[s] || s; }

// 省份中心坐标（用于地图聚焦缩放）
var PROVINCE_CENTERS = {
    '北京':[116.40,39.93],'天津':[117.20,39.13],'上海':[121.48,31.23],'重庆':[106.50,29.53],
    '河北':[114.50,38.03],'山西':[112.53,37.87],'辽宁':[123.43,41.80],'吉林':[125.30,43.88],
    '黑龙江':[126.63,45.75],'江苏':[118.78,32.04],'浙江':[120.15,30.28],'安徽':[117.27,31.86],
    '福建':[119.30,26.08],'江西':[115.89,28.68],'山东':[117.00,36.67],'河南':[113.65,34.76],
    '湖北':[114.30,30.60],'湖南':[112.98,28.20],'广东':[113.23,23.16],'广西':[108.33,22.84],
    '海南':[110.33,20.03],'四川':[104.07,30.57],'贵州':[106.71,26.57],'云南':[102.72,25.05],
    '西藏':[91.13,29.65],'陕西':[108.95,34.27],'甘肃':[104.50,37.20],'青海':[101.78,36.62],
    '宁夏':[106.27,38.47],'新疆':[87.62,43.79],'内蒙古':[111.67,40.82],'台湾':[121.00,25.00],
    '香港':[114.17,22.30],'澳门':[113.55,22.15]
};

// 省级行政区编码（用于DataV GeoAtlas加载市级GeoJSON）
var PROVINCE_CODE = {
    '北京':'110000','天津':'120000','河北':'130000','山西':'140000','内蒙古':'150000',
    '辽宁':'210000','吉林':'220000','黑龙江':'230000','上海':'310000','江苏':'320000',
    '浙江':'330000','安徽':'340000','福建':'350000','江西':'360000','山东':'370000',
    '河南':'410000','湖北':'420000','湖南':'430000','广东':'440000','广西':'450000',
    '海南':'460000','重庆':'500000','四川':'510000','贵州':'520000','云南':'530000',
    '西藏':'540000','陕西':'610000','甘肃':'620000','青海':'630000','宁夏':'640000',
    '新疆':'650000','香港':'810000','澳门':'820000','台湾':'710000',
};

// ============== 地图配色与镜头定位（通用机制） ==============
// 自然系分类色板（低饱和、高级感，适合彩色数据地图）
var TALENT_MAP_PALETTE = [
    '#6FA9A4', // 湖水青绿
    '#7FB59A', // 鼠尾草绿
    '#8FA8CE', // 雾蓝
    '#C2B07C', // 香槟沙金
    '#A8C686', // 浅草绿
    '#6E9FB8', // 天青蓝
    '#D4A373', // 暖陶橙
    '#8FB8A8', // 薄荷灰绿
    '#C98E6B', // 珊瑚暖褐
    '#9FB3D1', // 蓝灰
    '#B5C76F', // 橄榄绿
    '#7BA8C9'  // 湖蓝
];

// 颜色提亮工具：保持区域自身色相不变，仅向白色混合指定比例（用于 Hover 提亮，绝不覆盖为统一色）
function talentLightenColor(hex, percent) {
    var m = /^#?([0-9a-fA-F]{6})$/.exec(String(hex || ''));
    if (!m) return hex;
    var n = parseInt(m[1], 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var p = (typeof percent === 'number') ? percent : 0.35;
    r = Math.round(r + (255 - r) * p);
    g = Math.round(g + (255 - g) * p);
    b = Math.round(b + (255 - b) * p);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
// 区域 Hover 强调样式：仅"提亮自身颜色 + 金色描边 + 轻微发光"，不使用统一覆盖色
// （emphasis 中不出现固定 areaColor，是保证各区域彩色在 Hover 后不被冲掉的关键）
function talentRegionEmphasis(baseColor) {
    return {
        itemStyle: {
            areaColor: talentLightenColor(baseColor, 0.38),
            borderColor: '#C9A227',
            borderWidth: 2,
            shadowBlur: 14,
            shadowColor: 'rgba(201,162,39,.5)'
        },
        label: { color: '#5C3D06', fontWeight: 'bold' }
    };
}

// 省级行政区地理顺序（用于轮询取色，保证相邻省份颜色差异明显）
// 名称与 ECharts map data 全称一致（"北京市" / "广东省" / "内蒙古自治区" 等）
var TALENT_PROVINCE_ORDER = [
    '北京市','天津市','河北省','山西省','内蒙古自治区','辽宁省','吉林省','黑龙江省',
    '上海市','江苏省','浙江省','安徽省','福建省','江西省','山东省',
    '河南省','湖北省','湖南省','广东省','广西壮族自治区','海南省',
    '重庆市','四川省','贵州省','云南省','西藏自治区',
    '陕西省','甘肃省','青海省','宁夏回族自治区','新疆维吾尔自治区',
    '台湾省','香港特别行政区','澳门特别行政区'
];

// 构建全国地图彩色 regions（label 调整 + 港澳显式样式 + 每省分类色）
function talentBuildProvinceRegions() {
    var regions = [];
    TALENT_PROVINCE_ORDER.forEach(function(name, i) {
        var isGanga = name === '香港特别行政区' || name === '澳门特别行政区';
        var areaColor = isGanga ? '#E4C96A' : TALENT_MAP_PALETTE[i % TALENT_MAP_PALETTE.length];
        var r = {
            name: name,
            itemStyle: {
                areaColor: areaColor,
                borderColor: 'rgba(186,152,84,.5)',
                borderWidth: 1
            },
            // Hover 高亮：基于本省自身颜色的提亮色（与市级地图逻辑完全一致）
            emphasis: talentRegionEmphasis(areaColor)
        };
        // 小区域/长条形省份：调整 label 位置避免遮挡
        if (name === '甘肃省') r.label = { position: [104.5, 37.2] };
        if (name === '上海市') r.label = { position: [121.48, 31.23] };
        if (name === '北京市') r.label = { position: [116.40, 39.93] };
        if (name === '天津市') r.label = { position: [117.20, 39.13] };
        regions.push(r);
    });
    return regions;
}

// 地图基础 regions（彩色）
var REGIONS_BASE = talentBuildProvinceRegions();

// 系列层港澳高亮样式（覆盖透明系列层，确保小面积区域可见）
var REGIONS_FOR_SERIES = [
    { name: '香港特别行政区', itemStyle: { areaColor: '#E9C25A', borderColor: 'rgba(184,134,11,.75)', borderWidth: 2.5 } },
    { name: '澳门特别行政区', itemStyle: { areaColor: '#E9C25A', borderColor: 'rgba(184,134,11,.75)', borderWidth: 2.5 } }
];

// —— 全国地图金色数据流装饰（silent 纯视觉，不参与点击/Hover 交互）——
var GOLD_FLOW_LINES = [
    { coords: [[116.40, 39.93], [121.47, 31.23]] }, // 北京→上海
    { coords: [[116.40, 39.93], [113.26, 23.13]] }, // 北京→广州
    { coords: [[121.47, 31.23], [114.06, 22.54]] }, // 上海→深圳
    { coords: [[104.07, 30.57], [108.95, 34.27]] }, // 成都→西安
    { coords: [[114.30, 30.59], [120.15, 30.28]] }  // 武汉→杭州
];
var GOLD_FLOW_DOTS = [
    [116.40, 39.93], [121.47, 31.23], [113.26, 23.13], [114.06, 22.54],
    [104.07, 30.57], [108.95, 34.27], [114.30, 30.59], [120.15, 30.28]
];
// 生成金色装饰 series；empty=true 时清空数据（市级视图不需要装饰）
function talentGoldDecorSeries(empty) {
    var e = !!empty;
    return [
        {
            name: 'gold-flow-lines', type: 'lines', coordinateSystem: 'geo',
            zlevel: 2, silent: true,
            effect: { show: !e, period: 5, trailLength: 0.16, symbol: 'circle', symbolSize: 3, color: '#E8C878' },
            lineStyle: { color: 'rgba(222,190,120,.38)', width: 1, curveness: 0.25, opacity: 0.45 },
            data: e ? [] : GOLD_FLOW_LINES
        },
        {
            name: 'gold-flow-dots', type: 'effectScatter', coordinateSystem: 'geo',
            zlevel: 3, silent: true,
            symbolSize: 4,
            rippleEffect: { period: 4, scale: 2.4, brushType: 'stroke', color: '#E8C878' },
            label: { show: false },
            itemStyle: { color: '#E8C878', shadowBlur: 8, shadowColor: 'rgba(232,200,120,.7)' },
            data: e ? [] : GOLD_FLOW_DOTS
        }
    ];
}

// —— 通用镜头定位：省份 → 市级区域 → 主要城市区域中心 → 自动合理 Zoom ——
// 依据市级 GeoJSON 计算"主要城市区域"（排除零星岛屿）的外接范围中心与相对放大倍数
function talentRingSignedArea(ring) {
    var a = 0, n = ring.length;
    for (var i = 0; i < n - 1; i++) a += ring[i][0] * ring[i+1][1] - ring[i+1][0] * ring[i][1];
    return a / 2;
}
function talentFeatureArea(feature) {
    var g = feature.geometry, total = 0, minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    if (!g) return null;
    var polys = g.type === 'Polygon' ? [g.coordinates] : (g.type === 'MultiPolygon' ? g.coordinates : []);
    polys.forEach(function(poly) {
        var polyArea = 0;
        poly.forEach(function(ring, ri) {
            var ra = Math.abs(talentRingSignedArea(ring));
            polyArea += ri === 0 ? ra : -ra;
            ring.forEach(function(pt) {
                if (pt[0] < minX) minX = pt[0]; if (pt[0] > maxX) maxX = pt[0];
                if (pt[1] < minY) minY = pt[1]; if (pt[1] > maxY) maxY = pt[1];
            });
        });
        total += Math.max(0, polyArea);
    });
    if (minX > maxX) return null;
    return { area: total, minX: minX, minY: minY, maxX: maxX, maxY: maxY };
}
function talentComputeCityView(geoJson) {
    if (!geoJson || !geoJson.features || !geoJson.features.length) return null;
    var items = [], totalArea = 0;
    geoJson.features.forEach(function(f) {
        var m = talentFeatureArea(f);
        if (!m) return;
        totalArea += m.area;
        items.push({ name: (f.properties && f.properties.name) || '', area: m.area, minX: m.minX, minY: m.minY, maxX: m.maxX, maxY: m.maxY });
    });
    if (!items.length) return null;
    // —— 通用机制：基于"质心距离中位数"聚类识别主要城市区域 ——
    // 解决海南/广东/福建/辽宁/浙江/台湾等岛链省份中，
    // 远海小岛（如三沙/南澳/嵊泗/长海等）矩形面积大、远离本岛，
    // 用面积阈值会误把它们当主体；改用"质心到中位数中心"距离筛离群点
    var centers = items.map(function(it) { return { cx: (it.minX + it.maxX) / 2, cy: (it.minY + it.maxY) / 2 }; });
    var cxs = centers.map(function(c) { return c.cx; }).sort(function(a, b) { return a - b; });
    var cys = centers.map(function(c) { return c.cy; }).sort(function(a, b) { return a - b; });
    var medX = cxs[Math.floor(cxs.length / 2)];
    var medY = cys[Math.floor(cys.length / 2)];
    var dists = centers.map(function(c) { return Math.hypot(c.cx - medX, c.cy - medY); }).sort(function(a, b) { return a - b; });
    var medDist = dists[Math.floor(dists.length / 2)] || 0;
    // 阈值：中位数距离的 3 倍 + 0.5° 经度最小保护；离群点（远海大块飞地）将被排除
    var threshold = medDist * 3 + 0.5;
    var main = items.filter(function(it, i) {
        return Math.hypot(centers[i].cx - medX, centers[i].cy - medY) <= threshold;
    });
    // 保护：若阈值过严导致 < 50% feature 被保留，退而保留距离中位数最近的前 75%（至少 5 个）
    if (main.length < Math.max(5, items.length * 0.5)) {
        var indexed = items.map(function(it, i) { return { it: it, d: Math.hypot(centers[i].cx - medX, centers[i].cy - medY) }; });
        indexed.sort(function(a, b) { return a.d - b.d; });
        var keepN = Math.max(5, Math.floor(items.length * 0.75));
        main = indexed.slice(0, keepN).map(function(x) { return x.it; });
    }
    // 计算主要区域 bbox
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    main.forEach(function(it) {
        if (it.minX < minX) minX = it.minX; if (it.minY < minY) minY = it.minY;
        if (it.maxX > maxX) maxX = it.maxX; if (it.maxY > maxY) maxY = it.maxY;
    });
    // 全量 bbox（ECharts zoom=1 默认 fit 的基准）
    var fMinX = 1e9, fMinY = 1e9, fMaxX = -1e9, fMaxY = -1e9;
    items.forEach(function(it) {
        if (it.minX < fMinX) fMinX = it.minX; if (it.minY < fMinY) fMinY = it.minY;
        if (it.maxX > fMaxX) fMaxX = it.maxX; if (it.maxY > fMaxY) fMaxY = it.maxY;
    });
    var fw = Math.max(1e-9, fMaxX - fMinX), fh = Math.max(1e-9, fMaxY - fMinY);
    var tw = Math.max(1e-9, maxX - minX), th = Math.max(1e-9, maxY - minY);
    // ECharts zoom=1 默认按全量 bbox fit，因此 zoom 取"主要区域相对全量的放大倍数"，并保留呼吸边距
    var zoom = Math.min(fw / tw, fh / th);
    zoom = Math.max(1.05, Math.min(zoom * 0.76, 5.5));
    return { center: [(minX + maxX) / 2, (minY + maxY) / 2], zoom: zoom };
}

// API 基础路径
const API_BASE = (window.resolveApiBase ? window.resolveApiBase() : (window.API_BASE || location.origin)) + '/api';

function talentFetchJson(url, timeoutMs) {
    var ms = timeoutMs || 4000;
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, ms) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
        .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        })
        .finally(function () { if (timer) clearTimeout(timer); });
}

function talentPrefetchGeo() {
    if (talentMapState.geoJSON || talentMapState._geoLoading) return talentMapState._geoLoading;
    talentMapState._geoLoading = fetch('../assets/china-geo.json')
        .then(function (r) { return r.json(); })
        .then(function (geo) { talentMapState.geoJSON = geo; return geo; })
        .catch(function (e) {
            console.warn('[TalentMap] GeoJSON预加载失败', e);
            return null;
        })
        .finally(function () { talentMapState._geoLoading = null; });
    return talentMapState._geoLoading;
}

// ============== 初始化 ==============
window.initTalentMap = async function() {
    window.bindTalentMapEvents();
    talentPrefetchGeo();
    if (!talentMapState.dataLoaded) {
        await window.talentLoadData();
    }
    // 从 URL 参数恢复省份/城市/岗位筛选（支持刷新与直达链接，仅执行一次）
    if (!talentMapState.urlRestored) {
        talentMapState.urlRestored = true;
        await window.talentRestoreFromUrl();
    }
    if (talentMapState.currentLayer === 'map') {
        window.talentShowLayer('map');
        window.renderChinaMap();
    }
    window.updateTalentStats();
};

window.bindTalentMapEvents = function() {
    const view = document.getElementById('view-map');
    if (view.dataset.bound) return;
    view.dataset.bound = '1';
    // 图谱搜索
    const si = document.getElementById('talent-graph-search');
    if (si) si.addEventListener('input', function(e) {
        const term = e.target.value.trim().toLowerCase();
        window.talentGraphSearch(term);
    });
    // 响应窗口 resize
    window.addEventListener('resize', () => {
        if (talentMapState.mapChart) { talentMapState.mapChart.resize(); setTimeout(() => window.updateGangaGuideLines(), 100); }
        if (talentMapState.jobGraphInstance) {
            const c = document.getElementById('talent-graph-container');
            if (c && c.clientWidth > 10) talentMapState.jobGraphInstance.changeSize(c.clientWidth, c.clientHeight);
        }
    });
};

// ============== 薪资格式化（后端返回元/月） ==============
function talentFormatSalary(val) {
    if (!val || val <= 0) return '暂无数据';
    if (val >= 1000000) return '¥' + Math.round(val / 10000) + '万/月';
    return '¥' + val.toLocaleString() + '/月';
}

// ============== 数据加载 ==============
window.talentLoadData = async function() {
    const filt = window.talentGetFilters();
    let url = API_BASE + '/map/provinces?';
    if (filt.province) url += 'region=' + encodeURIComponent(filt.province) + '&';
    if (filt.job) url += 'job=' + encodeURIComponent(filt.job) + '&';
    if (filt.education) url += 'education=' + encodeURIComponent(filt.education) + '&';
    if (filt.experience) url += 'experience=' + encodeURIComponent(filt.experience) + '&';

    var provincesOk = false;
    var results = await Promise.allSettled([
        talentFetchJson(url, 4000),
        talentFetchJson(API_BASE + '/map/filters', 4000)
    ]);

    if (results[0].status === 'fulfilled') {
        try {
            const d = results[0].value.data || results[0].value;
            talentMapState.allProvinces = d.provinces || [];
            talentMapState.dataLoaded = true;
            if (d.regions && d.regions.length) window.talentInitProvinceOptions(d.regions);
            window.updateTalentStats();
            console.log('[TalentMap] 加载完成：' + talentMapState.allProvinces.length + ' 个省份');
            provincesOk = true;
        } catch (e) {
            console.warn('[TalentMap] 省份数据解析失败，使用Mock', e);
        }
    } else {
        console.warn('[TalentMap] 省份API失败，使用Mock', results[0].reason);
    }

    if (!provincesOk) window.talentUseMock();

    if (results[1].status === 'fulfilled') {
        try {
            var fd = results[1].value.data || results[1].value;
            if (fd.regions && fd.regions.length) window.talentInitProvinceOptions(fd.regions);
        } catch (e) {
            console.warn('[TalentMap] 筛选选项解析失败', e);
        }
    } else {
        console.warn('[TalentMap] 筛选选项API失败，使用省份名作为省份选项', results[1].reason);
        if (!provincesOk || talentMapState.allProvinces.length > 0) {
            var regions = talentMapState.allProvinces.map(function(p) { return p.name; });
            window.talentInitProvinceOptions(regions);
        }
    }
};

window.talentUseMock = function() {
    // avgSalary 单位：元/月（与后端一致）
    talentMapState.allProvinces = [
        {id:'beijing',name:'北京',jobCount:48520,hotIndex:95,growthRate:8.3,avgSalary:32000},
        {id:'shanghai',name:'上海',jobCount:45200,hotIndex:92,growthRate:7.8,avgSalary:31000},
        {id:'guangdong',name:'广东',jobCount:62300,hotIndex:88,growthRate:9.1,avgSalary:28000},
        {id:'zhejiang',name:'浙江',jobCount:38100,hotIndex:82,growthRate:10.2,avgSalary:26000},
        {id:'jiangsu',name:'江苏',jobCount:34500,hotIndex:79,growthRate:7.5,avgSalary:25000},
        {id:'sichuan',name:'四川',jobCount:28300,hotIndex:74,growthRate:11.3,avgSalary:22000},
        {id:'hubei',name:'湖北',jobCount:22100,hotIndex:68,growthRate:12.1,avgSalary:21000},
        {id:'hunan',name:'湖南',jobCount:18700,hotIndex:62,growthRate:8.9,avgSalary:19000},
        {id:'shandong',name:'山东',jobCount:25600,hotIndex:71,growthRate:6.7,avgSalary:20000},
        {id:'shaanxi',name:'陕西',jobCount:16300,hotIndex:65,growthRate:9.8,avgSalary:20000},
        {id:'henan',name:'河南',jobCount:19200,hotIndex:60,growthRate:7.2,avgSalary:18000},
        {id:'hebei',name:'河北',jobCount:15800,hotIndex:55,growthRate:5.1,avgSalary:17000},
        {id:'fujian',name:'福建',jobCount:17100,hotIndex:63,growthRate:8.4,avgSalary:21000},
        {id:'anhui',name:'安徽',jobCount:14500,hotIndex:57,growthRate:10.6,avgSalary:18000},
        {id:'liaoning',name:'辽宁',jobCount:13200,hotIndex:52,growthRate:4.2,avgSalary:17000},
        {id:'jilin',name:'吉林',jobCount:8900,hotIndex:44,growthRate:3.8,avgSalary:16000},
        {id:'heilongjiang',name:'黑龙江',jobCount:8700,hotIndex:42,growthRate:3.1,avgSalary:15000},
        {id:'guangxi',name:'广西',jobCount:9200,hotIndex:48,growthRate:6.5,avgSalary:16000},
        {id:'yunnan',name:'云南',jobCount:7800,hotIndex:46,growthRate:7.3,avgSalary:16000},
        {id:'guizhou',name:'贵州',jobCount:6500,hotIndex:41,growthRate:8.7,avgSalary:15000},
        {id:'gansu',name:'甘肃',jobCount:4200,hotIndex:32,growthRate:4.5,avgSalary:14000},
        {id:'qinghai',name:'青海',jobCount:1800,hotIndex:22,growthRate:3.2,avgSalary:14000},
        {id:'hainan',name:'海南',jobCount:5200,hotIndex:38,growthRate:6.8,avgSalary:18000},
        {id:'xinjiang',name:'新疆',jobCount:3800,hotIndex:30,growthRate:5.6,avgSalary:15000},
        {id:'neimenggu',name:'内蒙古',jobCount:5800,hotIndex:35,growthRate:4.9,avgSalary:16000},
        {id:'xizang',name:'西藏',jobCount:1200,hotIndex:20,growthRate:2.5,avgSalary:16000},
        {id:'ningxia',name:'宁夏',jobCount:2100,hotIndex:25,growthRate:5.3,avgSalary:15000},
        {id:'tianjin',name:'天津',jobCount:16200,hotIndex:61,growthRate:6.2,avgSalary:22000},
        {id:'chongqing',name:'重庆',jobCount:14800,hotIndex:58,growthRate:9.4,avgSalary:20000},
        {id:'taiwan',name:'台湾',jobCount:11200,hotIndex:54,growthRate:4.1,avgSalary:23000},
        {id:'xianggang',name:'香港',jobCount:9500,hotIndex:51,growthRate:3.5,avgSalary:35000},
        {id:'aomen',name:'澳门',jobCount:1100,hotIndex:28,growthRate:2.1,avgSalary:28000}
    ];
    talentMapState.dataLoaded = true;
    var regions = talentMapState.allProvinces.map(function(p) { return p.name; });
    window.talentInitProvinceOptions(regions);
    window.updateTalentStats();
};

window.talentFillDropdown = function(id, list, placeholder) {
    const sel = document.getElementById(id);
    if (!sel || !list || !list.length) return;
    const currentVal = sel.value;
    if (!placeholder) placeholder = id.includes('province') ? '全部省份' : id.includes('city') ? '全部地区' : '全部岗位';
    let html = '<option value="">' + placeholder + '</option>';
    list.forEach(v => { html += '<option value="' + v + '">' + v + '</option>'; });
    sel.innerHTML = html;
    sel.value = currentVal;
};

window.talentGetFilters = function() {
    const getVal = id => { const el = document.getElementById(id); return el ? el.value : ''; };
    return {
        province: getVal('talent-filter-province'),
        city: getVal('talent-filter-city'),
        job: getVal('talent-filter-job'),
        education: getVal('talent-filter-edu'),
        experience: getVal('talent-filter-exp')
    };
};

// ============== 省份 → 城市 → 岗位 级联筛选 ==============
// 省级行政区显示后缀：短名（数据库/地图用）→ 完整行政区名（下拉框显示用）
const TALENT_PROVINCE_SUFFIX = {
    '北京': '市', '天津': '市', '上海': '市', '重庆': '市',
    '内蒙古': '自治区', '广西': '壮族自治区', '西藏': '自治区',
    '宁夏': '回族自治区', '新疆': '维吾尔自治区',
    '香港': '特别行政区', '澳门': '特别行政区', '台湾': '省'
};
// 直辖市：下一级为区（北京 → 东城区/朝阳区…），列表需保留"省·区"格式以便按区匹配岗位数据
const TALENT_MUNICIPALITIES = ['北京', '上海', '天津', '重庆'];
window.talentIsMunicipality = function(name) {
    if (!name) return false;
    var n = String(name).replace(/市$/, '');
    return TALENT_MUNICIPALITIES.indexOf(n) >= 0;
};
window.talentProvinceDisplay = function(shortName) {
    if (!shortName) return '';
    if (/省|市|自治区|特别行政区$/.test(shortName)) return shortName;
    if (TALENT_PROVINCE_SUFFIX[shortName]) return shortName + TALENT_PROVINCE_SUFFIX[shortName];
    return shortName + '省';
};
window.talentCityDisplay = function(raw) {
    if (!raw) return '';
    var s = String(raw);
    // 直辖市区级条目（"北京·朝阳区"）显示为区名；普通条目取"·"前部分（地级市）
    var part = s.indexOf('·') >= 0 ? s.split('·').pop() : s;
    if (/市$|区$|县$/.test(part)) return part;
    return part + '市';
};
// 省份下拉框初始化：全国省级行政区列表，仅执行一次（避免被筛选结果过滤）
window.talentInitProvinceOptions = function(regions) {
    const sel = document.getElementById('talent-filter-province');
    if (!sel || !regions || !regions.length) return;
    if (sel.dataset.inited) return;
    sel.dataset.inited = '1';
    let html = '<option value="">全部省份</option>';
    regions.forEach(function(r) {
        const short = String(r).replace(/省|市|壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区/g, '');
        html += '<option value="' + short + '">' + window.talentProvinceDisplay(r) + '</option>';
    });
    sel.innerHTML = html;
};
// 请求省份下城市列表（/map/cities/{province}）
window.talentFetchCities = async function(provinceShort) {
    try {
        const res = await fetch(API_BASE + '/map/cities/' + encodeURIComponent(provinceShort));
        if (!res.ok) return [];
        const json = await res.json();
        const d = json.data || json;
        if (Array.isArray(d)) return d.map(function(c) { return typeof c === 'string' ? c : (c.name || ''); }).filter(Boolean);
        if (d && d.cities) return d.cities.map(function(c) { return typeof c === 'string' ? c : (c.name || ''); }).filter(Boolean);
        return [];
    } catch (e) { console.warn('[TalentMap] 城市列表API失败', e); return []; }
};
// 请求城市全部岗位（/map/city-jobs/{city}）
window.talentFetchCityJobs = async function(cityShort) {
    try {
        const res = await fetch(API_BASE + '/map/city-jobs/' + encodeURIComponent(cityShort));
        if (!res.ok) return [];
        const json = await res.json();
        const d = json.data || json;
        if (d && d.jobs) return d.jobs.map(function(j) { return j.name || j; }).filter(Boolean);
        if (Array.isArray(d)) return d.map(function(j) { return j.name || j; }).filter(Boolean);
        return [];
    } catch (e) { console.warn('[TalentMap] 城市岗位API失败', e); return []; }
};
// 地区列表规范化：普通省去掉"·"区县条目只保留市级；直辖市保留"省·区"完整格式；去重 + 中文排序
window.talentNormalizeCityList = function(cities, provinceShort) {
    var prov = provinceShort ? String(provinceShort).replace(/市$/, '') : '';
    // 香港/澳门仅省级（无下一级区域），地区下拉只保留"全部地区"
    if ((prov === '香港' || prov === '澳门')) return [];
    var isMun = TALENT_MUNICIPALITIES.indexOf(prov) >= 0;
    var seen = {}, out = [];
    (cities || []).forEach(function(c) {
        if (!c) return;
        var raw = String(c);
        if (isMun && raw.indexOf('·') < 0) return; // 直辖市只保留区级条目（"省·区"），过滤"北京"等补足项
        var key = isMun ? raw : String(raw).split('·')[0]; // 普通省截断为市级名（南昌·东湖区 → 南昌）
        if (!key) return;
        if (seen[key]) return;
        seen[key] = 1;
        out.push(key);
    });
    out.sort(function(a, b) { return a.localeCompare(b, 'zh'); });
    return out;
};
// 省份变化：加载该省城市，并清空之前的城市与岗位（防止"河南省 + 太原市"错位组合）
window.talentOnProvinceChange = async function() {
    const provSel = document.getElementById('talent-filter-province');
    const citySel = document.getElementById('talent-filter-city');
    const jobSel = document.getElementById('talent-filter-job');
    if (!provSel || !citySel || !jobSel) return;
    citySel.innerHTML = '<option value="">全部地区</option>';
    jobSel.innerHTML = '<option value="">全部岗位</option>';
    if (!provSel.value) return;
    const cities = window.talentNormalizeCityList(await window.talentFetchCities(provSel.value), provSel.value);
    let html = '<option value="">全部地区</option>';
    cities.forEach(function(c) { html += '<option value="' + c + '">' + window.talentCityDisplay(c) + '</option>'; });
    citySel.innerHTML = html;
};
// 城市变化：加载该城市岗位，并清空之前的岗位
window.talentOnCityChange = async function() {
    const citySel = document.getElementById('talent-filter-city');
    const jobSel = document.getElementById('talent-filter-job');
    if (!citySel || !jobSel) return;
    jobSel.innerHTML = '<option value="">全部岗位</option>';
    if (!citySel.value) return;
    const cityShort = window.talentNormalizeCityName(String(citySel.value).split('·').pop());
    const jobs = await window.talentFetchCityJobs(cityShort);
    let html = '<option value="">全部岗位</option>';
    jobs.forEach(function(j) { html += '<option value="' + j + '">' + j + '</option>'; });
    jobSel.innerHTML = html;
};
// 在岗位分析页中自动高亮并优先展示指定岗位（岗位筛选生效）
window.talentApplyJobHighlight = function(jobName) {
    if (!jobName) return;
    var tries = 0;
    var timer = setInterval(function() {
        tries++;
        var jobs = talentMapState.provinceJobs || [];
        var idx = -1;
        for (var i = 0; i < jobs.length; i++) {
            if (jobs[i].name === jobName) { idx = i; break; }
        }
        if (idx >= 0) {
            clearInterval(timer);
            window.talentSelectJob(idx);
            var cards = document.querySelectorAll('#talent-province-jobs .talent-job-card');
            if (cards[idx] && cards[idx].scrollIntoView) cards[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            return;
        }
        if (tries > 25) clearInterval(timer);
    }, 200);
};
// 更新 URL 参数：provinceId / cityId / jobId（单页 hash 应用，用 query 保留筛选状态，支持刷新恢复）
window.talentUpdateUrlParams = function(province, city, job) {
    try {
        const params = [];
        if (province) params.push('provinceId=' + encodeURIComponent(province));
        if (city) params.push('cityId=' + encodeURIComponent(city));
        if (job) params.push('jobId=' + encodeURIComponent(job));
        const qs = params.join('&');
        const base = location.pathname;
        const hash = location.hash;
        history.replaceState(null, '', qs ? (base + '?' + qs + hash) : (base + hash));
    } catch (e) { /* 忽略 */ }
};
// 从 URL 参数恢复筛选状态并进入对应岗位分析页面（刷新/直达链接）
window.talentRestoreFromUrl = async function() {
    try {
        const sp = new URLSearchParams(location.search);
        const prov = sp.get('provinceId');
        if (!prov) return;
        const city = sp.get('cityId') || '';
        const job = sp.get('jobId') || '';
        const provSel = document.getElementById('talent-filter-province');
        const citySel = document.getElementById('talent-filter-city');
        const jobSel = document.getElementById('talent-filter-job');
        if (!provSel || !citySel || !jobSel) return;
        provSel.value = prov;
        if (city) {
            const cities = window.talentNormalizeCityList(await window.talentFetchCities(prov), prov);
            let html = '<option value="">全部地区</option>';
            cities.forEach(function(c) { html += '<option value="' + c + '">' + window.talentCityDisplay(c) + '</option>'; });
            citySel.innerHTML = html;
            citySel.value = city;
            if (job) {
                const jobs = await window.talentFetchCityJobs(window.talentNormalizeCityName(String(city).split('·').pop()));
                let jobHtml = '<option value="">全部岗位</option>';
                jobs.forEach(function(j) { jobHtml += '<option value="' + j + '">' + j + '</option>'; });
                jobSel.innerHTML = jobHtml;
                jobSel.value = job;
            }
        }
        window.talentMapApplyFilter();
    } catch (e) {
        console.warn('[TalentMap] URL 参数恢复失败', e);
    }
};
// 重置全部筛选下拉框到初始状态（省份/城市/岗位/学历/经验）
window.talentResetFilterSelects = function() {
    const provSel = document.getElementById('talent-filter-province');
    const citySel = document.getElementById('talent-filter-city');
    const jobSel = document.getElementById('talent-filter-job');
    if (provSel) provSel.value = '';
    if (citySel) citySel.innerHTML = '<option value="">全部地区</option>';
    if (jobSel) jobSel.innerHTML = '<option value="">全部岗位</option>';
    ['talent-filter-edu', 'talent-filter-exp'].forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
};

window.updateTalentStats = function() {
    const p = talentMapState.allProvinces;
    const total = p.reduce((s, x) => s + (x.jobCount || 0), 0);
    const hotCount = p.filter(x => x.hotIndex >= 70).length;
    const el = document.getElementById('talent-stats-text');
    if (el) el.textContent = total.toLocaleString() + ' 个岗位 · ' + p.length + ' 个省份 · ' + hotCount + ' 个热门省份';
};

// 技能详情状态清理：离开图谱/切换省份/切换城市时调用。
// 不仅清状态变量，还要把被技能详情整体替换的右侧面板恢复为原内容，
// 否则返回地图后 renderProvinceDetail 找不到面板内元素而崩溃，导致面板残留技能详情。
window.talentClearTechDetail = function() {
    var panel = document.getElementById('talent-detail-province');
    if (panel && techDetailState.savedPanelHTML) {
        panel.innerHTML = techDetailState.savedPanelHTML;
        panel.style.display = techDetailState.savedPanelDisplay || 'block';
    }
    techDetailState.currentTech = null;
    techDetailState.savedPanelHTML = '';
    techDetailState.savedPanelDisplay = '';
};

// ============== 层级切换 ==============
window.talentShowLayer = function(layer) {
    talentMapState.currentLayer = layer;
    // 背板切换：地图层直接融入页面背景（无透明背板），岗位分析/技术脑图层保留透明背板
    var canvasEl = document.getElementById('talent-map-canvas');
    if (canvasEl) canvasEl.classList.toggle('canvas-panel', layer !== 'map');
    // 离开图谱层时清除技能详情状态并恢复右侧面板，防止状态残留
    if (layer !== 'graph') {
        window.talentClearTechDetail();
    }
    if (layer !== 'map' && talentMapState.breathTimer) { clearInterval(talentMapState.breathTimer); talentMapState.breathTimer = null; }
    ['map', 'province', 'graph'].forEach(l => {
        var el = document.getElementById('talent-layer-' + l);
        if (el) el.style.display = l === layer ? '' : 'none';
    });
    // 统一返回操作区（地图左上角）：各返回按钮按当前层显隐
    var backBtn = document.getElementById('talent-back-btn');
    var provBackBtn = document.getElementById('talent-province-back-btn');
    var graphBackBtn = document.getElementById('talent-graph-back-btn');
    var detailBackBtn = document.getElementById('talent-detail-back-btn');
    var showMapBack = layer === 'map' && talentMapState.selectedProvince;
    if (backBtn) backBtn.style.display = showMapBack || layer !== 'map' ? '' : 'none';
    if (provBackBtn) provBackBtn.style.display = layer === 'province' ? '' : 'none';
    if (graphBackBtn) graphBackBtn.style.display = layer === 'graph' ? '' : 'none';
    if (detailBackBtn) detailBackBtn.style.display = showMapBack ? '' : 'none';
    // 右侧面板
    var emptyPanel = document.getElementById('talent-detail-empty');
    var hoverPanel = document.getElementById('talent-detail-hover');
    var provPanel = document.getElementById('talent-detail-province');
    if (emptyPanel) emptyPanel.style.display = layer === 'map' && !talentMapState.selectedProvince ? 'flex' : 'none';
    if (hoverPanel) hoverPanel.style.display = 'none';
    if (provPanel) {
        if (layer === 'map' && talentMapState.selectedProvince) {
            provPanel.style.display = 'block';
            provPanel.style.animation = 'panelSlideIn .45s cubic-bezier(.4,0,.2,1) forwards';
        } else if (layer === 'graph') {
            provPanel.style.display = 'block';
        } else { provPanel.style.display = 'none'; }
    }
    // 岗位 Hover 详情面板：仅在岗位分析层显示，离开时清除（进入其他页面正常清除状态）
    var jobDetailPanel = document.getElementById('talent-detail-job');
    if (jobDetailPanel && layer !== 'province') jobDetailPanel.style.display = 'none';
    // 港澳放大框显隐
    var zoomBox = document.getElementById('ganga-zoom-box');
    var guideSvg = document.getElementById('ganga-guide-svg');
    if (zoomBox) zoomBox.style.display = layer === 'map' ? '' : 'none';
    if (guideSvg) guideSvg.style.display = layer === 'map' ? '' : 'none';
    // 调整画布大小
    if (layer === 'map' && talentMapState.mapChart) {
        setTimeout(function() { talentMapState.mapChart.resize(); }, 100);
    }
    if (layer === 'graph' && talentMapState.jobGraphInstance) {
        var c = document.getElementById('talent-graph-container');
        if (c && c.clientWidth > 10) setTimeout(function() { talentMapState.jobGraphInstance.changeSize(c.clientWidth, c.clientHeight); }, 100);
    }
};

window.talentMapBack = function() {
    if (talentMapState.currentLayer === 'graph') {
        // 岗位图谱 → 返回岗位分析页面
        talentMapState.selectedJob = null;
        window.talentClearTechDetail();
        if (talentMapState.mapLevel === 'city' && talentMapState.selectedCity) {
            // 从城市图谱返回城市岗位分析
            window.talentShowLayer('province');
            window.renderProvinceJobList(talentMapState.selectedProvince, talentMapState.selectedCity);
            window.talentUpdatePageTitle((talentMapState.selectedCity.displayName || talentMapState.selectedCity.name) + ' · 岗位分析');
        } else if (talentMapState.selectedProvince) {
            window.talentShowLayer('province');
            window.renderProvinceJobList(talentMapState.selectedProvince);
            window.talentUpdatePageTitle(talentMapState.selectedProvince.name);
        } else {
            talentMapState.mapMode = 'overview';
            window.talentShowLayer('map');
            window.renderChinaMap();
            document.getElementById('talent-back-btn').style.display = 'none';
        }
        document.getElementById('talent-back-btn').style.display = '';
    } else if (talentMapState.currentLayer === 'province') {
        // 岗位分析 → 返回地图：必须清除技能详情状态并恢复面板
        window.talentClearTechDetail();
        if (talentMapState.mapLevel === 'city') {
            // 城市岗位分析 → 返回省份地图（保持城市高亮）
            talentMapState.selectedCity = null;
            talentMapState.mapLevel = 'province';
            talentMapState.analysisLevel = 'province';
            window.talentShowLayer('map');
            if (talentMapState.selectedProvince) {
                window.talentRenderCityMap(talentMapState.currentProvinceName);
                window.renderProvinceDetail(talentMapState.selectedProvince);
                window.talentUpdatePageTitle(talentMapState.selectedProvince.name);
            }
            document.getElementById('talent-back-btn').style.display = '';
        } else {
            // 省份岗位分析 → 返回省份地图
            talentMapState.analysisLevel = 'province';
            window.talentShowLayer('map');
            if (talentMapState.selectedProvince) {
                if (talentMapState.mapLevel !== 'country' && talentMapState.cityGeoJSON) {
                    window.talentRenderCityMap(talentMapState.currentProvinceName);
                }
                window.renderProvinceDetail(talentMapState.selectedProvince);
                window.talentUpdatePageTitle(talentMapState.selectedProvince.name);
                document.getElementById('talent-back-btn').style.display = '';
            }
        }
    } else {
        // 地图模式下，根据 mapLevel 执行层级回退
        if (talentMapState.mapLevel === 'city' || talentMapState.mapLevel === 'province') {
            window.talentMapCityBack();
        } else {
            // 全国 → 恢复总览
            window.talentClearTechDetail();
            talentMapState.selectedProvince = null;
            talentMapState.selectedCity = null;
            talentMapState.mapMode = 'overview';
            talentMapState.analysisLevel = 'country';
            document.getElementById('talent-detail-province').style.display = 'none';
            document.getElementById('talent-detail-empty').style.display = 'flex';
            document.getElementById('talent-back-btn').style.display = 'none';
            window.talentRestorePageTitle();
            window.talentUnfocusProvince();
        }
    }
    // 恢复港澳凸显框
    var zoomBox = document.getElementById('ganga-zoom-box');
    var guideSvg = document.getElementById('ganga-guide-svg');
    if (zoomBox && talentMapState.currentLayer === 'map' && talentMapState.mapLevel === 'country') zoomBox.style.display = '';
    if (guideSvg && talentMapState.currentLayer === 'map' && talentMapState.mapLevel === 'country') guideSvg.style.display = '';
};

window.talentMapClickCurrent = function() {
    // 市级悬停时：点击进入该城市岗位分析
    if (talentMapState.hoveredCity && talentMapState.hoveredCity.name) {
        window.talentHandleCityClick(talentMapState.hoveredCity.name);
        return;
    }
    // 省级悬停时：点击进入省份详情
    if (talentMapState.hoveredProvince) {
        window.talentMapSelect(talentMapState.hoveredProvince);
    }
};

window.talentMapSelect = function(province) {
    if (!province || !province.name) return Promise.resolve();
    // 切换省份时清除技能详情状态（含恢复面板）和城市状态
    window.talentClearTechDetail();
    talentMapState.selectedCity = null;
    talentMapState.selectedJob = null;
    // 清空详情缓存，防止切换省份/城市后沿用上一省份/城市的数据
    talentMapState.cityDetailData = null;
    talentMapState.provinceDetailData = null;
    talentMapState.analysisLevel = 'province';
    talentMapState.selectedProvince = province;
    talentMapState.mapMode = 'province';
    talentMapState.currentLayer = 'map';
    talentMapState.hoveredProvince = null;
    document.getElementById('talent-detail-hover').style.display = 'none';
    document.getElementById('talent-detail-empty').style.display = 'none';

    // 保持港澳凸显框可见
    var zoomBox = document.getElementById('ganga-zoom-box');
    var guideSvg = document.getElementById('ganga-guide-svg');
    if (zoomBox) zoomBox.style.display = '';
    if (guideSvg) guideSvg.style.display = '';

    // 第一步：触发地图聚焦动画（zoom + 高亮 + 呼吸发光）
    window.talentFocusProvince(province);

    // 第二步：加载市级地图数据（返回 Promise：市级地图渲染完成后 resolve，
    // 供"应用筛选"等待后再复用城市/区点击逻辑进入地区岗位分析）
    var renderPromise = window.talentLoadCityGeo(province.name).then(function(geo) {
        if (!geo) return;
        return window.talentFetchCityData(province.name).then(function() {
            // 聚焦动画完成后切换至市级地图
            return new Promise(function(resolve) {
                setTimeout(function() {
                    window.talentRenderCityMap(province.name);
                    resolve();
                }, 750);
            });
        });
    });

    // 第三步：动画结束后右侧详情面板从右侧滑入
    setTimeout(function() {
        var panel = document.getElementById('talent-detail-province');
        if (panel) panel.style.display = 'block';
        if (panel) panel.style.animation = 'panelSlideIn .45s cubic-bezier(.4,0,.2,1) forwards';
        window.renderProvinceDetail(province);
        var backBtn = document.getElementById('talent-back-btn');
        if (backBtn) backBtn.style.display = '';
        window.talentUpdatePageTitle(province.name);
    }, 650);

    return renderPromise;
};

// 动态更新页面标题
window.talentUpdatePageTitle = function(name) {
    var h1 = document.querySelector('#view-map .page-title-block h1');
    var sub = document.querySelector('#view-map .page-title-block .subtitle');
    if (h1) h1.textContent = name + ' · 人才洞察';
    if (sub) sub.textContent = '岗位分布 · 技能需求 · 人才画像';
};
window.talentRestorePageTitle = function() {
    var h1 = document.querySelector('#view-map .page-title-block h1');
    var sub = document.querySelector('#view-map .page-title-block .subtitle');
    if (h1) h1.textContent = '数字人才地图';
    if (sub) sub.textContent = '全国人才分布 · 省份岗位洞察 · 岗位-能力知识图谱 · ';
};
// 地图聚焦到省份（平滑缩放 + 高亮）
window.talentFocusProvince = function(province) {
    var chart = talentMapState.mapChart;
    if (!chart) return;
    var geoName = toGeo(province.name);
    var center = PROVINCE_CENTERS[province.name] || [105, 35];
    var targetZoom = province.name === '广东' || province.name === '四川' || province.name === '新疆' || province.name === '内蒙古' ? 2.0 :
                      province.name === '上海' || province.name === '北京' || province.name === '天津' ? 6.0 :
                      province.name === '海南' ? 3.5 :
                      province.name === '香港' || province.name === '澳门' ? 8.0 : 3.2;

    var dv = talentMapState.defaultView;
    var startZoom = dv.zoom, startCx = dv.center[0], startCy = dv.center[1];
    var dur = 750, start = null;

    function step(ts) {
        if (!start) start = ts;
        var t = Math.min((ts - start) / dur, 1);
        var e = 1 - Math.pow(1 - t, 3); // easeOutCubic
        var z = startZoom + (targetZoom - startZoom) * e;
        var cx = startCx + (center[0] - startCx) * e;
        var cy = startCy + (center[1] - startCy) * e;
        chart.setOption({ geo: { zoom: z, center: [cx, cy] } });
        if (t < 1) { requestAnimationFrame(step); } else {
            // 高亮选中省份 + 暗淡其他
            window.talentApplyProvinceHighlight(province);
        }
    }
    requestAnimationFrame(step);
};
// 选中省份高亮发光 + 其他省份暗淡
window.talentApplyProvinceHighlight = function(province) {
    var chart = talentMapState.mapChart;
    if (!chart) return;
    var geoName = toGeo(province.name);
    var allNames = talentMapState.allProvinces.map(function(p) { return toGeo(p.name); });
    var regions = allNames
        .filter(function(n) { return n !== geoName; })
        .map(function(n) { return { name: n, itemStyle: { areaColor: 'rgba(250,240,210,.45)', borderColor: 'rgba(212,175,55,.15)' }, label: { color: 'rgba(70,52,10,.6)' } }; });
    regions.push({
        name: geoName, label: { show: true, fontSize: 13, color: '#5C3D06', fontWeight: 'bold' },
        itemStyle: { borderColor: '#D9A92E', borderWidth: 3, shadowBlur: 28, shadowColor: 'rgba(212,175,55,.55)', areaColor: '#F5DEA0' }
    });
    chart.setOption({ geo: { regions: regions } });
    // 呼吸动画
    if (talentMapState.breathTimer) clearInterval(talentMapState.breathTimer);
    var breathOn = false;
    talentMapState.breathTimer = setInterval(function() {
        // 仅在全国地图视角呼吸；市级下钻(mapLevel==='province')时绝不 setOption，
        // 否则部分 regions 合并会冲掉所有城市的独立颜色（首次进入颜色消失 Bug 的根源）
        if (!talentMapState.selectedProvince || talentMapState.currentLayer !== 'map' || talentMapState.mapLevel !== 'country') { clearInterval(talentMapState.breathTimer); talentMapState.breathTimer = null; return; }
        breathOn = !breathOn;
        chart.setOption({ geo: { regions: [{ name: geoName, itemStyle: { shadowBlur: breathOn ? 32 : 18 } }] } });
    }, 1800);
    // 重绘引导线
    setTimeout(function() { window.updateGangaGuideLines(); }, 100);
};
// 取消聚焦 → 恢复全国视角
window.talentUnfocusProvince = function() {
    var chart = talentMapState.mapChart;
    talentMapState.mapMode = 'overview';
    talentMapState.mapLevel = 'country';
    talentMapState.currentProvinceName = null;
    talentMapState.selectedCity = null;
    if (talentMapState.breathTimer) { clearInterval(talentMapState.breathTimer); talentMapState.breathTimer = null; }
    if (!chart) return;
    var dv = talentMapState.defaultView;
    // 切换回中国地图 GeoJSON
    chart.setOption({ geo: { map: 'china' } });
    chart.setOption({ series: [{ map: 'china' }] });
    // 恢复全国金色数据流装饰；series[0] 用空对象占住主地图索引，防止覆盖
    chart.setOption({ series: [{}].concat(talentGoldDecorSeries(false)) });
    var curZoom = dv.zoom, curCx = dv.center[0], curCy = dv.center[1];
    try { var opt = chart.getOption(); if (opt.geo && opt.geo[0]) { curZoom = opt.geo[0].zoom || dv.zoom; curCx = (opt.geo[0].center && opt.geo[0].center[0]) || dv.center[0]; curCy = (opt.geo[0].center && opt.geo[0].center[1]) || dv.center[1]; } } catch(e){}
    var dur = 600, start = null;
    function step(ts) {
        if (!start) start = ts;
        var t = Math.min((ts - start) / dur, 1);
        var e = 1 - Math.pow(1 - t, 3);
        var z = curZoom + (dv.zoom - curZoom) * e;
        var cx = curCx + (dv.center[0] - curCx) * e;
        var cy = curCy + (dv.center[1] - curCy) * e;
        chart.setOption({ geo: { zoom: z, center: [cx, cy], regions: REGIONS_BASE } });
        if (t >= 1) { chart.setOption({ geo: { zoom: dv.zoom, center: dv.center, regions: REGIONS_BASE, itemStyle: { areaColor: TALENT_MAP_PALETTE[0], borderColor: 'rgba(186,152,84,.5)' }, label: { color: 'rgba(30,52,44,.88)', fontWeight: 'normal' } } }); }
        if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
    setTimeout(function() { window.updateGangaGuideLines(); }, 650);
};

// ============== 市级下钻系统 ==============
window.talentLoadCityGeo = function(provinceName) {
    // 如果已加载同一省份，跳过
    if (talentMapState.cityGeoLoaded === provinceName) return Promise.resolve(talentMapState.cityGeoJSON);
    const adcode = PROVINCE_CODE[provinceName];
    if (!adcode) return Promise.resolve(null);
    const url = 'https://geo.datav.aliyun.com/areas_v3/bound/' + adcode + '_full.json';
    return fetch(url).then(function(r) { return r.json(); }).then(function(geo) {
        talentMapState.cityGeoJSON = geo;
        talentMapState.cityGeoLoaded = provinceName;
        echarts.registerMap(provinceName + '-cities', geo);
        return geo;
    }).catch(function() { return null; });
};

window.talentFetchCityData = function(provinceName) {
    var filt = window.talentGetFilters();
    var url = API_BASE + '/map/cities/' + encodeURIComponent(provinceName) + '?';
    if (filt.job) url += 'job=' + encodeURIComponent(filt.job) + '&';
    if (filt.education) url += 'education=' + encodeURIComponent(filt.education) + '&';
    if (filt.experience) url += 'experience=' + encodeURIComponent(filt.experience) + '&';
    return fetch(url).then(function(r) { return r.json(); }).then(function(d) {
        talentMapState.cityData = (d.data || []);
        return talentMapState.cityData;
    }).catch(function() { talentMapState.cityData = []; return []; });
};

window.talentRenderCityMap = function(provinceName) {
    var geoName = provinceName + '-cities';
    talentMapState.mapLevel = 'province';
    talentMapState.currentProvinceName = provinceName;
    // 关键修复：进入市级地图立即停止省份呼吸动画定时器。
    // 该定时器的 setOption({geo:{regions:[{name:'省名',...}]}}) 会在市级视图触发重渲染，
    // 导致所有城市的独立颜色被全局默认色覆盖（首次进入后颜色消失 Bug 的根源）
    if (talentMapState.breathTimer) { clearInterval(talentMapState.breathTimer); talentMapState.breathTimer = null; }

    // 市级地图镜头：通用机制自动计算"主要城市区域"的中心与合理 Zoom
    // （依据市级 GeoJSON 排除零星岛屿，避免周边岛屿拉大视野压缩主体城市，海南/广东/福建/辽宁等自动适用）
    var cityView = talentComputeCityView(talentMapState.cityGeoJSON);
    var mapZoom = cityView ? cityView.zoom : 0.95;
    var cityCenter = cityView ? cityView.center : undefined;

    // 城市板块分类色 regions（依据 GeoJSON 区域名轮询自然色板）
    // 每个城市始终保留自己独立的颜色；Hover 仅使用"自身颜色提亮 + 金色描边"的 emphasis
    var cityRegions = [];
    if (talentMapState.cityGeoJSON && talentMapState.cityGeoJSON.features) {
        talentMapState.cityGeoJSON.features.forEach(function(f, fi) {
            var nm = f.properties && f.properties.name;
            if (!nm) return;
            var areaColor = TALENT_MAP_PALETTE[fi % TALENT_MAP_PALETTE.length];
            cityRegions.push({
                name: nm,
                itemStyle: {
                    areaColor: areaColor,
                    borderColor: 'rgba(186,152,84,.5)',
                    borderWidth: 1
                },
                emphasis: talentRegionEmphasis(areaColor)
            });
        });
    }

    var chart = talentMapState.mapChart;
    var cityData = talentMapState.cityData;
    var mapData = [];
    cityData.forEach(function(c) {
        // 直辖市区级条目（"北京·朝阳区"）在 geoJSON 中的区域名为区名（"朝阳区"），rawName 保留数据库完整名
        var geoName = String(c.name).indexOf('·') >= 0 ? String(c.name).split('·').pop() : c.name;
        mapData.push({ name: geoName, value: c.jobCount || 0, avgSalary: c.avgSalary || 0, rawName: c.name });
    });

    chart.setOption({
        geo: {
            map: geoName,
            roam: true,
            zoom: mapZoom,
            center: cityCenter,
            label: { show: true, color: 'rgba(30,52,44,.9)', fontSize: 10, distance: 0 },
            itemStyle: { areaColor: TALENT_MAP_PALETTE[0], borderColor: 'rgba(186,152,84,.5)', borderWidth: 1 },
            emphasis: {
                // 不设置 areaColor：Hover 时填充色始终由各城市自身 regions 样式决定，避免整图变成同一种颜色
                itemStyle: { borderColor: '#C9A227', borderWidth: 2, shadowBlur: 14, shadowColor: 'rgba(201,162,39,.45)' },
                label: { color: '#5C3D06', fontSize: 12 }
            },
            regions: cityRegions
        },
        series: [{
            type: 'map', map: geoName, geoIndex: 0,
            data: mapData,
            itemStyle: {
                areaColor: 'rgba(0,0,0,0)',
                borderColor: 'rgba(186,152,84,.5)',
                borderWidth: 1
            },
            emphasis: {
                // 不设置 areaColor：透明交互层 Hover 时只加金色描边/发光，不冲掉下层城市本色
                itemStyle: { borderColor: '#C9A227', borderWidth: 2, shadowBlur: 12, shadowColor: 'rgba(201,162,39,.35)' }
            }
        }].concat(talentGoldDecorSeries(true))
    });

    // 更新 mousemove 事件（市级地图：悬停城市 → 右侧城市预览，不隐藏省级分析面板）
    chart.off('mousemove');
    chart.on('mousemove', function(params) {
        if (talentMapState.mapLevel !== 'province' || talentMapState.selectedCity) return;
        if (params.componentType === 'series' && params.name) {
            var city = window.talentFindCityData(talentMapState.cityData, params.name);
            if (city) {
                var hoverName = String(city.name).indexOf('·') >= 0 ? String(city.name).split('·').pop() : city.name;
                talentMapState.hoveredCity = city;
                // 地图高亮联动：城市边框发光（echarts map 自带 emphasis，这里主动触发一次保证联动反馈）
                if (talentMapState.hoveredCityName !== params.name) {
                    // 关键：切换悬停城市前，先恢复上一个城市的常态（downplay），
                    // 防止手动 highlight 状态残留导致多个城市停留在同一种强调色上
                    if (talentMapState.hoveredCityName) {
                        try { chart.dispatchAction({ type: 'downplay', name: talentMapState.hoveredCityName }); } catch (e) {}
                    }
                    try { chart.dispatchAction({ type: 'highlight', name: params.name }); } catch (e) {}
                }
                talentMapState.hoveredCityName = params.name;
                // 右侧显示地区预览：基本信息立即更新，热门岗位/技能/占比异步加载
                document.getElementById('talent-detail-empty').style.display = 'none';
                document.getElementById('talent-detail-province').style.display = 'block';
                document.getElementById('talent-detail-hover').style.display = 'block';
                document.getElementById('talent-hover-name').textContent = hoverName;
                var badge = document.getElementById('talent-hover-badge');
                badge.textContent = '地区';
                badge.style.background = 'rgba(245,158,11,.14)';
                badge.style.color = '#d97706';
                document.getElementById('talent-hover-hot-wrap').style.display = 'none';
                document.getElementById('talent-hover-growth-wrap').style.display = 'none';
                document.getElementById('talent-hover-city-block').style.display = 'block';
                document.getElementById('talent-hover-jobs').textContent = '岗位总数 ' + (city.jobCount || 0).toLocaleString();
                document.getElementById('talent-hover-salary').textContent = talentFormatSalary(city.avgSalary);
                var btn = document.getElementById('talent-hover-btn');
                if (btn) btn.textContent = '进入地区岗位分析 →';
                window.talentShowCityPreview(city);
            }
        }
    });

    chart.off('mouseout');
    chart.on('mouseout', function() {
        if (talentMapState.selectedCity) return;
        // 鼠标移出地图：恢复最后一个悬停城市的常态，确保所有城市回到各自原始颜色
        if (talentMapState.hoveredCityName) {
            try { chart.dispatchAction({ type: 'downplay', name: talentMapState.hoveredCityName }); } catch (e) {}
        }
        talentMapState.hoveredCity = null;
        talentMapState.hoveredCityName = null;
        // 省级面板保持可见，仅隐藏悬浮提示
        document.getElementById('talent-detail-hover').style.display = 'none';
        if (!talentMapState.selectedProvince) {
            document.getElementById('talent-detail-empty').style.display = 'flex';
        }
    });

    // 点击城市：兼容 series/geo 两种组件类型
    chart.off('click');
    chart.on('click', function(params) {
        if (!params || !params.name) return;
        if (params.componentType === 'series' || params.componentType === 'geo') {
            window.talentHandleCityClick(params.name);
        }
    });
};

// ============== 市级悬停预览：热门岗位 / 热门技术 / 行业占比 / 学历占比 ==============
// 悬停城市时按需请求后端预览接口（带缓存，同城市只请求一次）
window.talentShowCityPreview = function(city) {
    if (!city || !city.name) return;
    var shortName = window.talentNormalizeCityName(city.name) || city.name;
    var cacheKey = shortName;
    if (!talentMapState.cityPreviewCache) talentMapState.cityPreviewCache = {};
    if (talentMapState.cityPreviewCache[cacheKey]) {
        window.talentRenderCityPreview(city.name, talentMapState.cityPreviewCache[cacheKey]);
        return;
    }
    var provinceName = talentMapState.currentProvinceName || '';
    var url = API_BASE + '/map/city-preview/' + encodeURIComponent(provinceName) + '/' + encodeURIComponent(shortName);
    fetch(url).then(function(r) { return r.json(); }).then(function(res) {
        var d = res && res.data;
        if (!d) return;
        talentMapState.cityPreviewCache[cacheKey] = d;
        // 防止快速切换城市时旧请求覆盖新城市（区级条目以 geoJSON 区名比较，如"朝阳区"）
        var geoName = String(city.name).indexOf('·') >= 0 ? String(city.name).split('·').pop() : city.name;
        if (talentMapState.hoveredCityName === geoName) {
            window.talentRenderCityPreview(city.name, d);
        }
    }).catch(function() {});
};

// 渲染城市预览数据到右侧悬停面板
window.talentRenderCityPreview = function(cityName, d) {
    if (!d) return;
    // 热门岗位 TOP5
    var hjEl = document.getElementById('talent-hover-hotjobs');
    if (hjEl) {
        if (d.hotJobs && d.hotJobs.length) {
            hjEl.innerHTML = d.hotJobs.map(function(j, i) {
                var sal = '';
                if (j.avgSalary) sal = ' · ' + window.talentFormatSalary(j.avgSalary);
                return '<div class="detail-rel-item"><span class="name">' + (i + 1) + '. ' + (j.name || '') + '</span><span class="rel">' + (j.count || 0) + ' 条' + sal + '</span></div>';
            }).join('');
        } else {
            hjEl.innerHTML = '<div style="color:var(--text-muted);font-size:12px">暂无数据</div>';
        }
    }
    // 热门技术 TOP5
    var skEl = document.getElementById('talent-hover-skills');
    if (skEl) {
        if (d.hotSkills && d.hotSkills.length) {
            skEl.innerHTML = d.hotSkills.map(function(s) { return '<span class="talent-hover-skill">' + s + '</span>'; }).join('');
        } else {
            skEl.innerHTML = '<div style="color:var(--text-muted);font-size:12px">暂无数据</div>';
        }
    }
    // 行业占比 / 学历占比
    window.talentRenderPctList('talent-hover-industry', d.industryDist);
    window.talentRenderPctList('talent-hover-edu', d.educationDist);
    // 接口返回更精确的岗位总数/平均薪资，覆盖地图聚合值
    if (d.totalJobs) document.getElementById('talent-hover-jobs').textContent = '岗位总数 ' + (d.totalJobs || 0).toLocaleString();
    if (d.avgSalary) document.getElementById('talent-hover-salary').textContent = window.talentFormatSalary(d.avgSalary);
};

// 通用占比条渲染（行业/学历通用）
window.talentRenderPctList = function(elId, dist) {
    var el = document.getElementById(elId);
    if (!el) return;
    if (!dist || !dist.length) {
        el.innerHTML = '<div style="color:var(--text-muted);font-size:12px">暂无数据</div>';
        return;
    }
    el.innerHTML = dist.map(function(item) {
        var pct = item.pct || 0;
        var pctText = (pct > 0 && pct < 1) ? pct.toFixed(1) + '%' : Math.round(pct) + '%';
        return '<div class="talent-hover-pct-row">'
            + '<div class="talent-hover-pct-head"><span><b>' + (item.name || '') + '</b></span><span>' + pctText + '</span></div>'
            + '<div class="talent-hover-bar"><div style="width:' + pct + '%"></div></div>'
            + '</div>';
    }).join('');
};

// 地区名称规范化：去除 "市/县/区/新区/自治州" 后缀；"省·区"格式（北京·朝阳区）取后半段为区级短名
window.talentNormalizeCityName = function(name) {
    if (!name) return name;
    var s = String(name);
    if (s.indexOf('·') >= 0) s = s.split('·').pop();
    return s.replace(/自治州$/, '').replace(/地区$/, '').replace(/盟$/, '').replace(/市$/, '').replace(/县$/, '').replace(/新区$/, '').replace(/区$/, '');
};

// 在市级/区级地图数据（cityData）中按名称匹配城市/区（兼容 geoJSON 区名 → 数据库"省·区"名）
window.talentFindCityData = function(cityData, name) {
    if (!cityData || !name) return null;
    var n = String(name);
    var hit = cityData.find(function(c) { return String(c.name) === n; });
    if (hit) return hit;
    // 区名匹配："朝阳区" ↔ "北京·朝阳区"
    hit = cityData.find(function(c) { return String(c.name).indexOf('·') >= 0 && String(c.name).split('·').pop() === n; });
    if (hit) return hit;
    // 规范化短名匹配（"南昌市" ↔ "南昌"）
    var short = window.talentNormalizeCityName(n);
    hit = cityData.find(function(c) { return window.talentNormalizeCityName(c.name) === short; });
    return hit || null;
};

window.talentHandleCityClick = function(cityName) {
    if (!cityName) return Promise.resolve();
    // 名称匹配：先精确匹配，再区名/短名匹配，兜底直接用点击名构造城市对象
    var shortName = window.talentNormalizeCityName(cityName);
    var city = window.talentFindCityData(talentMapState.cityData, cityName);
    if (!city) city = { name: shortName };
    var rawName = String(city.name || cityName);
    // 直辖市区级条目（"北京·朝阳区"）页面显示为区名（"朝阳区"），简称（"朝阳"）用于后端查询
    if (rawName.indexOf('·') >= 0 && !city.displayName) {
        city = Object.assign({}, city, { displayName: rawName.split('·').pop() });
    } else if (city.name !== cityName && !city.displayName) {
        // 保留原始点击名称（如"南昌市"）用于页面显示，简称（如"南昌"）用于后端查询
        city = Object.assign({}, city, { displayName: cityName });
    }
    // 直接进入城市岗位分析：清除技能详情状态 + 重置旧筛选条件（防止省级筛选继承导致查询为空）
    window.talentClearTechDetail();
    window.talentResetFilterSelects();
    talentMapState.selectedCity = city;
    talentMapState.mapLevel = 'city';
    talentMapState.analysisLevel = 'city';
    document.getElementById('talent-detail-hover').style.display = 'none';
    document.getElementById('talent-detail-empty').style.display = 'none';
    return window.talentMapEnterCity(city);
};

window.talentMapCityBack = function() {
    // 清除技能详情状态并恢复面板
    window.talentClearTechDetail();
    if (talentMapState.mapLevel === 'city') {
        // 城市 → 返回省份
        talentMapState.selectedCity = null;
        talentMapState.mapLevel = 'province';
        talentMapState.analysisLevel = 'province';
        var chart = talentMapState.mapChart;
        chart.dispatchAction({ type: 'downplay', seriesIndex: 0 });
        var provName = talentMapState.currentProvinceName;
        window.talentRenderCityMap(provName); // 重绘清除高亮
        window.renderProvinceDetail(talentMapState.selectedProvince);
        window.talentUpdatePageTitle(talentMapState.selectedProvince.name);
    } else if (talentMapState.mapLevel === 'province') {
        // 省份 → 返回全国
        talentMapState.selectedProvince = null;
        talentMapState.selectedCity = null;
        talentMapState.mapLevel = 'country';
        talentMapState.analysisLevel = 'country';
        talentMapState.currentProvinceName = null;
        talentMapState.cityGeoJSON = null;
        talentMapState.cityGeoLoaded = null;
        talentMapState.cityData = [];
        talentMapState.mapMode = 'overview';
        document.getElementById('talent-detail-province').style.display = 'none';
        document.getElementById('talent-detail-empty').style.display = 'flex';
        document.getElementById('talent-back-btn').style.display = 'none';
        window.talentRestorePageTitle();
        window.talentUnfocusProvince();
        // 恢复省点击事件
        var chart = talentMapState.mapChart;
        chart.off('click');
        chart.on('click', function(params) {
            if (params.componentType === 'series' && params.name) {
                var short = toShort(params.name);
                var p = talentMapState.allProvinces.find(function(x) { return x.name === short; });
                if (p) window.talentMapSelect(p);
            }
        });
        // 恢复 hover 事件
        chart.off('mousemove');
        chart.on('mousemove', function(params) {
            if (talentMapState.mapMode !== 'overview' || talentMapState.selectedProvince) return;
            if (params.componentType === 'series' && params.name) {
                var short = toShort(params.name);
                var p = talentMapState.allProvinces.find(function(x) { return x.name === short; });
                if (p && talentMapState.hoveredProvince !== p) {
                    talentMapState.hoveredProvince = p;
                    window.talentShowHover(p);
                }
            }
        });
        chart.off('mouseout');
        chart.on('mouseout', function() {
            if (talentMapState.mapMode !== 'overview' || talentMapState.selectedProvince) return;
            talentMapState.hoveredProvince = null;
            var emp = document.getElementById('talent-detail-empty');
            var hov = document.getElementById('talent-detail-hover');
            if (emp && talentMapState.currentLayer === 'map') emp.style.display = 'flex';
            if (hov) hov.style.display = 'none';
        });
        var zoomBox = document.getElementById('ganga-zoom-box');
        var guideSvg = document.getElementById('ganga-guide-svg');
        if (zoomBox) zoomBox.style.display = '';
        if (guideSvg) guideSvg.style.display = '';
        window.updateGangaZoomBox();
    }
};

// ============== 进入城市岗位分析（复用省份岗位分析页面） ==============
window.talentMapEnterCity = function(cityNameObj) {
    var cityName = typeof cityNameObj === 'string' ? cityNameObj : (cityNameObj ? cityNameObj.name : null);
    if (!cityName) { window.Utils.showToast('城市名称无效', 'amber'); return; }
    
    var selectedCity = typeof cityNameObj === 'object' ? cityNameObj : { name: cityName };
    // 记录规范化短名（去除"市/区"后缀）供后端查询；"省·区"条目（北京·朝阳区）取后半段区级短名
    if (!selectedCity.shortName) {
        selectedCity.shortName = window.talentNormalizeCityName(selectedCity.name || cityName);
    }
    var displayName = selectedCity.displayName || selectedCity.name || cityName;
    
    // 清除技能详情状态并恢复面板
    window.talentClearTechDetail();
    // 清空城市详情缓存：进入城市必须重新请求该城市数据，避免显示上一城市岗位
    talentMapState.cityDetailData = null;
    
    // 设置城市层级状态
    talentMapState.selectedCity = selectedCity;
    talentMapState.mapLevel = 'city';
    talentMapState.analysisLevel = 'city';
    
    // 保存省份上下文
    if (talentMapState.selectedProvince && talentMapState.selectedProvince.name) {
        talentMapState.currentProvinceName = talentMapState.selectedProvince.name;
    }
    
    // 显示城市岗位分析页面（复用 layer-province）
    window.talentShowLayer('province');
    window.talentUpdatePageTitle(displayName + ' · 岗位分析');
    
    // 更新地图为市级地图（带高亮）
    if (talentMapState.mapChart && talentMapState.currentProvinceName) {
        talentMapState.mapChart.dispatchAction({ type: 'downplay', seriesIndex: 0 });
    }
    
    // 更新返回按钮（必须在 return 之前执行，避免被渲染流程跳过）
    var backBtn = document.getElementById('talent-back-btn');
    if (backBtn) backBtn.style.display = '';
    // 加载城市岗位数据到右侧面板（返回 Promise，便于调用方等待渲染完成后再做岗位高亮）
    var suffix = talentMapState.currentProvinceName ? ' ' + talentMapState.currentProvinceName : '';
    return window.renderProvinceJobList({ name: displayName + suffix, stCode: '', admCode: '' }, selectedCity);
};

// ============== 港澳局部放大框 ==============
window.updateGangaZoomBox = function() {
    const provinces = talentMapState.allProvinces;
    const hk = provinces.find(p => p.name === '香港');
    const mo = provinces.find(p => p.name === '澳门');
    const maxCount = Math.max(...provinces.map(p => p.jobCount || 0), 1);
    if (hk) {
        document.getElementById('ganga-bar-hk').style.width = ((hk.jobCount || 0) / maxCount * 100) + '%';
        document.getElementById('ganga-data-hk').textContent = (hk.jobCount || 0).toLocaleString();
    }
    if (mo) {
        document.getElementById('ganga-bar-mo').style.width = ((mo.jobCount || 0) / maxCount * 100) + '%';
        document.getElementById('ganga-data-mo').textContent = (mo.jobCount || 0).toLocaleString();
    }
    // 高亮选中省份
    document.querySelectorAll('.ganga-zoom-province').forEach(el => el.classList.remove('active'));
    if (talentMapState.selectedProvince) {
        const el = document.querySelector('.ganga-zoom-province[data-province="' + talentMapState.selectedProvince.name + '"]');
        if (el) el.classList.add('active');
    }
    setTimeout(() => window.updateGangaGuideLines(), 50);
};
window.updateGangaGuideLines = function() {
    const chart = talentMapState.mapChart;
    if (!chart) return;
    try {
        const hkPx = chart.convertToPixel({geoIndex: 0}, [113.55, 22.18]);
        const moPx = chart.convertToPixel({geoIndex: 0}, [113.33, 22.13]);
        const box = document.getElementById('ganga-zoom-box');
        const canvas = document.getElementById('talent-map-canvas');
        if (!hkPx || !moPx || !box || !canvas) return;
        const boxR = box.getBoundingClientRect();
        const cvR = canvas.getBoundingClientRect();
        const bx = boxR.left - cvR.left;
        const by = boxR.top - cvR.top;
        const bh = boxR.height;
        const hkTx = bx, hkTy = by + bh * 0.38;
        const moTx = bx, moTy = by + bh * 0.68;
        // 折线：主地图点 → 先向右走一段 → 再向左进入放大框
        const hkMidX = hkPx[0] + (hkTx - hkPx[0]) * 0.55;
        const moMidX = moPx[0] + (moTx - moPx[0]) * 0.7;
        document.getElementById('ganga-path-hk').setAttribute('d', 'M' + hkPx[0] + ',' + hkPx[1] + ' L' + hkMidX + ',' + hkPx[1] + ' L' + hkMidX + ',' + hkTy + ' L' + hkTx + ',' + hkTy);
        document.getElementById('ganga-path-mo').setAttribute('d', 'M' + moPx[0] + ',' + moPx[1] + ' L' + moMidX + ',' + moPx[1] + ' L' + moMidX + ',' + moTy + ' L' + moTx + ',' + moTy);
        // 定位小圆点
        document.getElementById('ganga-dot-hk').setAttribute('cx', hkPx[0]); document.getElementById('ganga-dot-hk').setAttribute('cy', hkPx[1]);
        document.getElementById('ganga-dot-mo').setAttribute('cx', moPx[0]); document.getElementById('ganga-dot-mo').setAttribute('cy', moPx[1]);
    } catch(e) { /* chart not ready */ }
};
window.gangaZoomClick = function(provinceName) {
    const p = talentMapState.allProvinces.find(x => x.name === provinceName);
    if (p && talentMapState.currentLayer === 'map') {
        window.talentMapSelect(p);
        window.updateGangaZoomBox();
    }
};
window.gangaZoomHover = function(provinceName, enter) {
    // 仅在 overview 模式（未点击选中省份）下才允许悬停更新右侧面板
    if (enter && talentMapState.currentLayer === 'map' && talentMapState.mapMode === 'overview') {
        const p = talentMapState.allProvinces.find(x => x.name === provinceName);
        if (p) {
            talentMapState.hoveredProvince = p;
            window.talentShowHover(p);
        }
    } else if (!enter) {
        if (talentMapState.mapMode !== 'overview') return;
        talentMapState.hoveredProvince = null;
        const emp = document.getElementById('talent-detail-empty');
        const hov = document.getElementById('talent-detail-hover');
        if (emp && talentMapState.currentLayer === 'map') emp.style.display = 'flex';
        if (hov) hov.style.display = 'none';
    }
};

// ============== 筛选 ==============
// 应用筛选：根据 省份 → 地区 → 岗位 生成路由参数并跳转对应岗位分析
// 有省份时直接复用地图点省逻辑 talentMapSelect（镜头动画/地图高亮/省份详情/市级地图），
// 省份 + 具体地区再复用现有地区点击逻辑（talentHandleCityClick）进入地区岗位分析，
// 确保筛选路径与点击地图省份路径完全等价、状态（selectedProvince/高亮/详情/镜头）一致。
window.talentMapApplyFilter = async function() {
    var filt = window.talentGetFilters();
    var provinceShort = filt.province;
    var cityRaw = filt.city;
    var jobName = filt.job;
    var prov = null;
    if (provinceShort) {
        prov = talentMapState.allProvinces.find(function(p) { return p.name === provinceShort; });
        if (!prov) prov = { name: provinceShort, id: provinceShort };
    }

    // 更新 URL 参数（provinceId / cityId / jobId），支持刷新与直达链接
    window.talentUpdateUrlParams(provinceShort, cityRaw, jobName);

    // 有省份 → 复用地图点省逻辑 talentMapSelect（等价于点击地图省份，不另写跳转逻辑）
    if (prov) {
        talentMapState.selectedJob = null;
        window.talentClearTechDetail();
        // 确保先切回地图层（等价于点击地图省份前的状态），talentMapSelect 不含层切换
        window.talentShowLayer('map');
        // 包含镜头动画、地图高亮、右侧省份详情、市级/区级地图渲染
        await window.talentMapSelect(prov);
        // 省份 + 具体地区 → 复用现有地区点击逻辑进入对应地区岗位分析
        if (cityRaw) {
            await window.talentHandleCityClick(cityRaw);
        }
        // 省份 + 全部地区 → 已停留于市级/区级地图 + 右侧省份详情（与点击地图省份最终状态一致）；
        // 直辖市 + 全部地区 → 即直辖市整体岗位分析
        if (jobName) window.talentApplyJobHighlight(jobName);
        return;
    }

    // 无省份 → 恢复全国总览（学历/经验筛选仍参与热力图数据过滤）
    await window.talentLoadData();
    talentMapState.selectedProvince = null;
    talentMapState.selectedCity = null;
    talentMapState.selectedJob = null;
    talentMapState.mapMode = 'overview';
    talentMapState.mapLevel = 'country';
    window.talentShowLayer('map');
    window.talentRestorePageTitle();
    window.renderChinaMap();
};

window.talentMapToggleFilter = function() {
    const panel = document.getElementById('graph-filter-panel');
    const toggle = document.getElementById('graph-filter-toggle');
    if (!panel || !toggle) return;
    const isOpen = panel.classList.toggle('open');
    toggle.classList.toggle('moved', isOpen);
    toggle.title = isOpen ? '收起筛选' : '展开筛选';
    const tabLabel = toggle.querySelector('.tab-label');
    if (tabLabel) tabLabel.textContent = isOpen ? '收起' : '筛选';
};

window.talentMapResetFilter = function() {
    // 恢复初始状态：省份=全部省份、地区=全部地区、岗位=全部岗位、学历/经验=不限
    // 地区与岗位下拉框清空省份关联数据（只保留"全部地区/全部岗位"占位）
    window.talentResetFilterSelects();
    window.talentMapApplyFilter();
};

// ============== 中国地图渲染 ==============
window.renderChinaMap = async function() {
    const el = document.getElementById('talent-layer-map');
    if (!el) return;
    // 加载 GeoJSON
    if (!talentMapState.geoJSON) {
        try {
            if (talentMapState._geoLoading) {
                await talentMapState._geoLoading;
            } else {
                const res = await fetch('../assets/china-geo.json');
                talentMapState.geoJSON = await res.json();
            }
        } catch (e) {
            console.warn('[TalentMap] GeoJSON加载失败', e);
            talentMapState.geoJSON = null;
        }
    }
    if (talentMapState.mapChart) { try { talentMapState.mapChart.dispose(); } catch(e){} }
    const mapChart = echarts.init(el);
    talentMapState.mapChart = mapChart;

    const data = talentMapState.allProvinces.map(p => ({
        name: toGeo(p.name),
        value: p.jobCount || 0
    }));

    const option = {
        tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(255,255,255,.95)',
            borderColor: 'rgba(212,175,55,.35)',
            borderWidth: 1,
            textStyle: { color: '#2A2110', fontSize: 12 },
            formatter: function(params) {
                const short = toShort(params.name);
                const p = talentMapState.allProvinces.find(x => x.name === short);
                if (!p) return params.name + '<br/>--';
                return '<div style="font-weight:700;color:#8F6B0E;margin-bottom:4px">' + p.name + '</div>'
                    + '岗位数量：<b>' + (p.jobCount || 0).toLocaleString() + '</b><br/>'
                    + '热门指数：<b>' + (p.hotIndex || '--') + '</b><br/>'
                    + '增长率：<b style="color:' + ((p.growthRate || 0) >= 0 ? '#8F6B0E' : '#f87171') + '">'
                    + (p.growthRate >= 0 ? '↑' : '↓') + Math.abs(p.growthRate || 0) + '%</b><br/>'
                    + '点击查看详情';
            }
        },
        geo: {
            map: 'china',
            roam: false,
            zoom: talentMapState.defaultView.zoom,
            center: [105.5, 36.5],
            layoutCenter: ['54%', '50%'],
            layoutSize: '80%',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            label: {
                show: true,
                fontSize: 9,
                color: 'rgba(30,52,44,.88)',
                fontFamily: 'DM Sans, Noto Sans SC',
                formatter: function(params) {
                    var hidden = ['香港','澳门','香港特别行政区','澳门特别行政区','Hong Kong','Macau'];
                    return hidden.indexOf(params.name) >= 0 ? '' : params.name;
                }
            },
            regions: REGIONS_BASE,
            emphasis: {
                label: {
                    show: true, fontSize: 13, color: '#5C3D06',
                    formatter: function(params) {
                        var hidden = ['香港','澳门','香港特别行政区','澳门特别行政区','Hong Kong','Macau'];
                        return hidden.indexOf(params.name) >= 0 ? '' : params.name;
                    }
                },
                // 不设置 areaColor：填充色始终由各区域自身 itemStyle/emphasis 决定，避免 Hover 后颜色被统一覆盖
                itemStyle: { borderColor: '#C9A227', borderWidth: 2, shadowBlur: 22, shadowColor: 'rgba(201,162,39,.5)' }
            },
            itemStyle: {
                areaColor: TALENT_MAP_PALETTE[0],
                borderColor: 'rgba(186,152,84,.5)',
                borderWidth: 1
            }
        },
        series: [{
            type: 'map',
            map: 'china',
            geoIndex: 0,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            data: data,
            regions: REGIONS_FOR_SERIES,
            itemStyle: {
                areaColor: 'rgba(0,0,0,0)',
                borderColor: 'rgba(186,152,84,.5)',
                borderWidth: 1
            },
            emphasis: {
                // 不设置 areaColor：透明交互层 Hover 时只加金色描边/发光，不冲掉下层区域本色
                itemStyle: { borderColor: '#C9A227', borderWidth: 2, shadowBlur: 16, shadowColor: 'rgba(201,162,39,.4)' }
            },
            label: {
                formatter: function(params) {
                    var hidden = ['香港','澳门','香港特别行政区','澳门特别行政区','Hong Kong','Macau'];
                    return hidden.indexOf(params.name) >= 0 ? '' : params.name;
                }
            }
        }].concat(talentGoldDecorSeries(false))
    };

    if (talentMapState.geoJSON) {
        echarts.registerMap('china', talentMapState.geoJSON);
    }

    mapChart.setOption(option);

    // 事件绑定
    mapChart.off('click');
    mapChart.on('click', function(params) {
        if (!params || !params.name) return;
        const short = toShort(params.name);
        const p = talentMapState.allProvinces.find(x => x.name === short);
        if (p) {
            console.log('[TalentMap] 点击省份:', p.name);
            window.talentMapSelect(p);
        }
    });

    mapChart.off('mousemove');
    mapChart.on('mousemove', function(params) {
        // hover 只在 overview 模式且无选中省份时生效
        if (talentMapState.mapMode !== 'overview' || talentMapState.selectedProvince) return;
        if (params.componentType === 'series' && params.name) {
            var short = toShort(params.name);
            var p = talentMapState.allProvinces.find(function(x) { return x.name === short; });
            if (p && talentMapState.hoveredProvince !== p) {
                talentMapState.hoveredProvince = p;
                window.talentShowHover(p);
            }
        }
    });

    mapChart.off('mouseout');
    mapChart.on('mouseout', function() {
        // 有选中省份时不恢复空面板
        if (talentMapState.mapMode !== 'overview' || talentMapState.selectedProvince) return;
        talentMapState.hoveredProvince = null;
        var emptyPanel = document.getElementById('talent-detail-empty');
        var hoverPanel = document.getElementById('talent-detail-hover');
        if (emptyPanel && talentMapState.currentLayer === 'map') emptyPanel.style.display = 'flex';
        if (hoverPanel) hoverPanel.style.display = 'none';
    });

    // 更新港澳放大框
    window.updateGangaZoomBox();
};

function talentShowHover(p) {
    // 安全锁：若已选中省份（province 模式下），不覆盖右侧面板
    if (talentMapState.selectedProvince && talentMapState.currentLayer === 'map' && talentMapState.mapMode !== 'overview') return;
    // 省级悬停：恢复热门指数/增长率格子，隐藏市级预览区块，按钮恢复默认文案
    var hotWrap = document.getElementById('talent-hover-hot-wrap');
    var growthWrap = document.getElementById('talent-hover-growth-wrap');
    var cityBlock = document.getElementById('talent-hover-city-block');
    if (hotWrap) hotWrap.style.display = '';
    if (growthWrap) growthWrap.style.display = '';
    if (cityBlock) cityBlock.style.display = 'none';
    var hbtn = document.getElementById('talent-hover-btn');
    if (hbtn) hbtn.textContent = '查看详情 →';
    document.getElementById('talent-detail-empty').style.display = 'none';
    document.getElementById('talent-detail-province').style.display = 'none';
    document.getElementById('talent-detail-hover').style.display = 'block';
    document.getElementById('talent-hover-name').textContent = p.name;
    document.getElementById('talent-hover-jobs').textContent = (p.jobCount || 0).toLocaleString();
    document.getElementById('talent-hover-hot').textContent = p.hotIndex || '--';
    const growth = p.growthRate || 0;
    const gEl = document.getElementById('talent-hover-growth');
    gEl.textContent = (growth >= 0 ? '↑' : '↓') + Math.abs(growth) + '%';
    gEl.style.color = growth >= 0 ? '#8F6B0E' : '#f87171';
    document.getElementById('talent-hover-salary').textContent = talentFormatSalary(p.avgSalary);
    const badge = document.getElementById('talent-hover-badge');
    badge.textContent = (p.hotIndex >= 80 ? '热门' : p.hotIndex >= 60 ? '活跃' : '增长中');
    badge.style.background = p.hotIndex >= 80 ? 'rgba(244,63,94,.15)' : p.hotIndex >= 60 ? 'rgba(245,158,11,.18)' : 'rgba(212,175,55,.18)';
    badge.style.color = p.hotIndex >= 80 ? '#f43f5e' : p.hotIndex >= 60 ? '#b45309' : '#8F6B0E';
}
window.talentShowHover = talentShowHover;

// 省份详情API缓存
window.talentFetchProvinceDetail = async function(provinceName) {
    if (!provinceName) return null;
    var provId = PROVINCE_CODE[provinceName] || provinceName;
    var filt = window.talentGetFilters();
    var qs = '?';
    if (filt.job) qs += 'job=' + encodeURIComponent(filt.job) + '&';
    if (filt.education) qs += 'education=' + encodeURIComponent(filt.education) + '&';
    if (filt.experience) qs += 'experience=' + encodeURIComponent(filt.experience) + '&';
    try {
        var res = await fetch(API_BASE + '/map/province/' + encodeURIComponent(provId) + (qs.length > 1 ? qs : ''));
        var json = await res.json();
        var d = json.data || json;
        return d;
    } catch(e) {
        console.warn('[TalentMap] 省份详情API失败', e);
        return null;
    }
};

// 城市详情API：城市岗位分析永远全量查询，不继承省级筛选条件（industry/job/education/experience 置空），
// 避免省级筛选状态残留导致城市查询结果为空、误报"暂无岗位数据"。
window.talentFetchCityDetail = async function(provinceName, cityName) {
    if (!provinceName || !cityName) return null;
    try {
        var res = await fetch(API_BASE + '/map/city/' + encodeURIComponent(provinceName) + '/' + encodeURIComponent(cityName));
        var json = await res.json();
        var d = json.data || json;
        return d;
    } catch(e) {
        console.warn('[TalentMap] 城市详情API失败', e);
        return null;
    }
};

// 城市岗位全量兜底：后端在岗位不足 20 时会自动 AI 生成并【写入数据库】后重新返回 ≥20 条
window.talentFetchCityJobsFull = async function(cityName) {
    if (!cityName) return null;
    try {
        var res = await fetch(API_BASE + '/map/city-jobs/' + encodeURIComponent(cityName));
        var json = await res.json();
        return json.data || json;
    } catch(e) {
        console.warn('[TalentMap] 城市岗位全量API失败', e);
        return null;
    }
};

// ============== 省份详情（右侧面板） ==============
window.renderProvinceDetail = async function(province) {
    if (!province) return;

    // 填充右侧面板 talent-detail-province（空值防护：面板若曾被技能详情整体替换，会先由 talentClearTechDetail 恢复）
    var provNameEl = document.getElementById('talent-prov-detail-name');
    var provSubEl = document.getElementById('talent-prov-detail-sub');
    if (provNameEl) provNameEl.textContent = province.name + ' · 数字人才洞察';
    if (provSubEl) provSubEl.textContent = '岗位分布 · 技能需求 · 人才画像';

    var grid = document.getElementById('talent-prov-stats-grid');
    if (grid) {
        grid.innerHTML = '<div class="detail-stat"><div class="detail-stat-label">岗位数量</div><div class="detail-stat-value">' + (province.jobCount || 0).toLocaleString() + '</div></div>'
            + '<div class="detail-stat"><div class="detail-stat-label">热门指数</div><div class="detail-stat-value">' + (province.hotIndex || '--') + '</div></div>'
            + '<div class="detail-stat"><div class="detail-stat-label">增长率</div><div class="detail-stat-value" style="color:' + ((province.growthRate||0)>=0?'#8F6B0E':'#f87171') + '">' + ((province.growthRate||0)>=0?'\u2191':'\u2193') + Math.abs(province.growthRate||0) + '%</div></div>'
            + '<div class="detail-stat"><div class="detail-stat-label">平均薪资</div><div class="detail-stat-value">' + talentFormatSalary(province.avgSalary) + '</div></div>';
    }

    // 请求真实省份详情API，获取topJobs、education、experience、skills
    var topEl = document.getElementById('talent-prov-top-jobs');
    var detail = await window.talentFetchProvinceDetail(province.name);
    if (detail && detail.topJobs && detail.topJobs.length > 0) {
        // 使用真实topJobs数据
        var topJobsHtml = detail.topJobs.slice(0, 10).map(function(j) {
            return '<span class="skill-matched">' + (j.name || j.title || '') + '</span>';
        }).join('');
        if (topEl) topEl.innerHTML = topJobsHtml || '<span class="skill-matched" style="opacity:.5">暂无热门岗位</span>';

        // 更新统计：用真实数据覆盖 initial 聚合数据
        if (detail.totalJobs && grid) {
            grid.innerHTML = '<div class="detail-stat"><div class="detail-stat-label">岗位数量</div><div class="detail-stat-value">' + (detail.totalJobs || 0).toLocaleString() + '</div></div>'
                + '<div class="detail-stat"><div class="detail-stat-label">平均薪资</div><div class="detail-stat-value">' + talentFormatSalary(detail.avgSalary || province.avgSalary) + '</div></div>'
                + '<div class="detail-stat"><div class="detail-stat-label">热门岗位</div><div class="detail-stat-value" style="font-size:13px">' + (detail.topJobs ? detail.topJobs.length : 0) + ' 个</div></div>'
                + '<div class="detail-stat"><div class="detail-stat-label">增长率</div><div class="detail-stat-value" style="color:' + ((province.growthRate||0)>=0?'#8F6B0E':'#f87171') + '">' + ((province.growthRate||0)>=0?'\u2191':'\u2193') + Math.abs(province.growthRate||0) + '%</div></div>';
        }

        // 保存详情数据供岗位分析使用
        talentMapState.provinceDetailData = detail;
    } else {
        if (topEl) topEl.innerHTML = '<span class="skill-matched" style="opacity:.5">数据加载中...</span>';
    }

    // 趋势图
    setTimeout(function() {
        var trendEl = document.getElementById('talent-prov-trend');
        if (!trendEl || trendEl.offsetParent === null) return;
        if (echarts.getInstanceByDom(trendEl)) echarts.getInstanceByDom(trendEl).dispose();
        var c = echarts.init(trendEl);
        var trendData = (detail && detail.trend) ? detail.trend :
            Array.from({ length: 7 }, function(_, i) { return Math.floor((province.jobCount || 1000) * (0.85 + Math.random() * 0.3)); });
        c.setOption({
            grid: { left: 36, right: 10, top: 10, bottom: 20 },
            xAxis: { type: 'category', data: ['Day1','Day2','Day3','Day4','Day5','Day6','Day7'], axisLabel: { color: '#475569', fontSize: 9 } },
            yAxis: { type: 'value', axisLabel: { color: '#475569', fontSize: 9 }, splitLine: { lineStyle: { color: '#f1f3f9' } } },
            series: [{
                type: 'line', smooth: true, symbol: 'circle', symbolSize: 4,
                lineStyle: { width: 2, color: '#D9A92E' }, itemStyle: { color: '#D9A92E' },
                areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(217,169,46,.4)' }, { offset: 1, color: 'rgba(217,169,46,0)' }] } },
                data: trendData
            }]
        });
    }, 100);
};

// ============== 省份/城市岗位分析（全屏层） ==============
window.renderProvinceJobList = async function(province, selectedCity) {
    if (!province) return;
    
    var isCity = talentMapState.mapLevel === 'city' && selectedCity;
    var displayName = isCity ? (selectedCity.displayName || selectedCity.name) : province.name;
    var fetchProvName = isCity ? talentMapState.currentProvinceName : province.name;
    // 查询 API 使用规范化短名（"南昌"），显示使用全称（"南昌市"）
    var fetchCityName = isCity ? (selectedCity.shortName || selectedCity.name) : null;

    var titleEl = document.getElementById('talent-province-title');
    if (titleEl) titleEl.textContent = displayName + ' · 数字人才洞察';

    var statsEl = document.getElementById('talent-province-stats');
    if (statsEl) statsEl.innerHTML = '<span>岗位数 --</span> | <span>热门指数 --</span> | <span>平均薪资 --</span>';

    // 优先使用已缓存的detailData，否则请求API
    var detail = isCity ? talentMapState.cityDetailData : talentMapState.provinceDetailData;
    if (!detail || !detail.topJobs || !detail.topJobs.length) {
        if (isCity && fetchCityName) {
            detail = await window.talentFetchCityDetail(fetchProvName, fetchCityName);
            talentMapState.cityDetailData = detail || {};
        } else {
            detail = await window.talentFetchProvinceDetail(province.name);
            talentMapState.provinceDetailData = detail || {};
        }
    }
    // 城市岗位仍为空时的兜底：调用全量接口（后端不足 20 时自动 AI 生成并【写入数据库】后返回 ≥20 条）
    if (isCity && fetchCityName && (!detail || !detail.topJobs || !detail.topJobs.length)) {
        var fb = await window.talentFetchCityJobsFull(fetchCityName);
        if (fb && fb.jobs && fb.jobs.length) {
            detail = {
                totalJobs: fb.totalJobs || fb.jobs.length,
                avgSalary: 0,
                topJobs: fb.jobs.map(function(j, i) {
                    return {
                        id: i + 1, name: j.name, count: j.count || 20,
                        avgSalary: j.avgSalary || 0, hot: j.hot || 0,
                        category: j.category || '',
                        skills: (j.skills && j.skills.length) ? j.skills : []
                    };
                })
            };
            talentMapState.cityDetailData = detail;
        }
    }

    var topJobs = (detail && detail.topJobs && detail.topJobs.length > 0) ? detail.topJobs : [];
    talentMapState.provinceJobs = topJobs;
    talentMapState.selectedJob = null;

    if (topJobs.length === 0) {
        var jobsEl = document.getElementById('talent-province-jobs');
        if (jobsEl) jobsEl.innerHTML = '<div style="color:rgba(255,255,255,.35);padding:40px;text-align:center">' + displayName + '暂无岗位数据，请检查数据库或筛选条件</div>';
        return;
    }

    // 更新统计条
    if (detail && detail.avgSalary && statsEl) {
        statsEl.innerHTML = '<span>岗位数 ' + (detail.totalJobs || 0).toLocaleString() + '</span> | <span>热门指数 ' + (province.hotIndex || '--') + '</span> | <span>平均薪资 ' + talentFormatSalary(detail.avgSalary) + '</span>';
    }

    var jobsHTML = '';
    topJobs.forEach(function(j, i) {
        var salaryText = j.avgSalary ? talentFormatSalary(j.avgSalary) : '--';
        var skills = (j.skills && j.skills.length) ? j.skills : [];
        var skillsHtml = skills.map(function(s) { return '<span class="talent-job-skill">' + s + '</span>'; }).join('');
        var categoryHtml = (j.category || j.level) ? '<span class="talent-job-category">' + (j.category || j.level) + '</span>' : '';
        // 横向信息流布局：岗位名称 → 薪资 → 热度 → 岗位类别 → 技术标签 → TOP排名 → 岗位数量 → 操作按钮
        jobsHTML += '<div class="talent-job-card" data-idx="' + i + '" onclick="window.talentSelectJob(' + i + ')">'
            + '<span class="talent-job-name">' + (j.name || '') + '</span>'
            + '<span class="talent-job-salary">💰 ' + salaryText + '</span>'
            + '<span class="talent-job-hot">🔥 热度 ' + (j.hot || 0) + '</span>'
            + categoryHtml
            + '<span class="talent-job-skills">' + skillsHtml + '</span>'
            + '<span class="talent-job-top">TOP ' + (i+1) + '</span>'
            + '<span class="talent-job-count">' + (j.count || 0).toLocaleString() + ' 个岗位</span>'
            + '<button class="talent-job-btn" onclick="event.stopPropagation();window.talentSelectJob(' + i + ');window.talentMapEnterGraph()">进入知识图谱 →</button>'
            + '</div>';
    });
    var jobsEl = document.getElementById('talent-province-jobs');
    if (jobsEl) jobsEl.innerHTML = jobsHTML;

    // 岗位卡片 Hover 联动（事件委托，只绑定一次）：
    // 鼠标悬停某张岗位卡片 → 右侧立即显示该岗位详情；移出后保持最后一个岗位信息，避免频繁闪烁
    var jobsBox = document.getElementById('talent-province-jobs');
    if (jobsBox && !jobsBox.__jobHoverBound) {
        jobsBox.__jobHoverBound = true;
        jobsBox.addEventListener('mouseover', function(e) {
            if (talentMapState.currentLayer !== 'province') return;
            var card = e.target && e.target.closest ? e.target.closest('.talent-job-card') : null;
            if (!card) return;
            var idx = parseInt(card.getAttribute('data-idx'), 10);
            var job = (talentMapState.provinceJobs || [])[idx];
            if (job) window.talentShowJobDetail(job);
        });
    }
};

// 渲染岗位详情到右侧面板（仅使用现有数据字段：name/count/avgSalary/hot/category/skills）
window.talentShowJobDetail = function(job) {
    if (!job) return;
    var panel = document.getElementById('talent-detail-job');
    if (!panel) return;
    var emptyPanel = document.getElementById('talent-detail-empty');
    var hoverPanel = document.getElementById('talent-detail-hover');
    var provPanel = document.getElementById('talent-detail-province');
    if (emptyPanel) emptyPanel.style.display = 'none';
    if (hoverPanel) hoverPanel.style.display = 'none';
    if (provPanel) provPanel.style.display = 'none';
    panel.style.display = 'block';

    var salaryText = job.avgSalary ? talentFormatSalary(job.avgSalary) : '--';
    var skills = (job.skills && job.skills.length) ? job.skills : [];
    var skillsHtml = skills.map(function(s) { return '<span class="skill-matched">' + s + '</span>'; }).join('');
    panel.innerHTML = '<div class="detail-content">'
        + '<div class="talent-job-detail-name">' + (job.name || '') + '</div>'
        + '<div class="talent-job-detail-sub">岗位详细信息 · 悬停左侧岗位卡片切换查看</div>'
        + '<div class="detail-stat-grid">'
        + '<div class="detail-stat"><div class="detail-stat-label">岗位数量</div><div class="detail-stat-value">' + (job.count || 0).toLocaleString() + '</div></div>'
        + '<div class="detail-stat"><div class="detail-stat-label">平均薪资</div><div class="detail-stat-value">' + salaryText + '</div></div>'
        + '<div class="detail-stat"><div class="detail-stat-label">热度</div><div class="detail-stat-value">' + (job.hot || 0) + '</div></div>'
        + '<div class="detail-stat"><div class="detail-stat-label">岗位类别</div><div class="detail-stat-value" style="font-size:13px">' + (job.category || job.level || '--') + '</div></div>'
        + '</div>'
        + '<div class="detail-section-title">核心技术</div>'
        + '<div class="talent-job-detail-skills">' + (skillsHtml || '<div style="color:var(--text-muted);font-size:12px">暂无数据</div>') + '</div>'
        + '</div>';
};

// 从右侧面板进入省份岗位分析（带镜头飞入动画）
window.talentMapEnterProvince = function() {
    var prov = talentMapState.selectedProvince;
    if (!prov) return;

    // 清除技能详情状态并恢复面板，设置为省级分析
    window.talentClearTechDetail();
    talentMapState.analysisLevel = 'province';
    talentMapState.selectedCity = null;
    talentMapState.mapLevel = 'province';

    // 防重复点击
    if (talentMapState.isEnteringProvince) return;
    talentMapState.isEnteringProvince = true;

    // 禁用按钮
    var btn = document.querySelector('#talent-detail-province .btn-primary');
    if (btn) btn.disabled = true;

    var chart = talentMapState.mapChart;
    var center = PROVINCE_CENTERS[prov.name] || [105, 35];
    var dv = talentMapState.defaultView;

    // 保存当前 zoom 以便恢复
    var curZoom = dv.zoom;
    try {
        var opt = chart.getOption();
        if (opt.geo && opt.geo[0]) curZoom = opt.geo[0].zoom || dv.zoom;
    } catch(e) {}
    talentMapState.flyInSavedZoom = curZoom;

    // 目标缩放：在当前聚焦基础上再放大 3 倍（不同省份 curZoom 2.0~8.0 → 6.0~24.0）
    var targetZoom = curZoom * 3.0;
    var dur = 900, start = null;
    var overlayTriggered = false, ov = document.getElementById('talent-flyin-overlay');

    // 停止呼吸动画（飞入期间不干扰）
    if (talentMapState.breathTimer) { clearInterval(talentMapState.breathTimer); talentMapState.breathTimer = null; }

    function step(ts) {
        if (!start) start = ts;
        var t = Math.min((ts - start) / dur, 1);
        // easeInOutCubic：前 450ms 加速 → 后 450ms 减速
        // 缩放在前后半程均等分布（各 50%），产生明显的推进纵深
        var e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        var z = curZoom + (targetZoom - curZoom) * e;
        chart.setOption({ geo: { zoom: z, center: center } });

        // 动画收尾（90%）提前触发叠加层，最后 10% 时间叠层与缩放并行，无缝衔接
        if (t >= 0.90 && !overlayTriggered) {
            overlayTriggered = true;
            if (ov) ov.classList.add('active');
        }

        if (t < 1) {
            requestAnimationFrame(step);
        } else {
            // 动画完成立即切换，零等待
            chart.setOption({ geo: { zoom: talentMapState.flyInSavedZoom, center: center } });

            window.talentShowLayer('province');
            window.renderProvinceJobList(prov);
            document.getElementById('talent-back-btn').style.display = '';
            window.talentUpdatePageTitle(prov.name);

            if (ov) ov.classList.remove('active');
            talentMapState.isEnteringProvince = false;
            talentMapState.flyInSavedZoom = null;
            if (btn) btn.disabled = false;
        }
    }
    requestAnimationFrame(step);
};

window.talentSelectJob = function(idx) {
    if (idx == null) return;
    // 切换岗位时清除技能详情状态
    window.talentClearTechDetail();
    var jobs = talentMapState.provinceJobs || [];
    if (idx >= 0 && idx < jobs.length) {
        var job = jobs[idx];
        talentMapState.selectedJob = {
            id: 'job-' + idx,
            name: job.name,
            category: job.category || '',
            count: job.count || 0,
            avgSalary: job.avgSalary || 0,
            skills: job.skills || []
        };
    }
    // 高亮选中的卡片
    document.querySelectorAll('#talent-province-jobs .talent-job-card').forEach((card, i) => {
        card.style.borderColor = i === idx ? '#F0C75C' : 'rgba(255,255,255,.1)';
    });
};

function talentShowProvinceDetailPanel(province, job) {
    document.getElementById('talent-detail-hover').style.display = 'none';
    document.getElementById('talent-detail-empty').style.display = 'none';
    document.getElementById('talent-detail-province').style.display = 'block';
    document.getElementById('talent-prov-detail-name').textContent = province.name + ' · ' + (job ? job.name : '岗位能力');
    document.getElementById('talent-prov-detail-sub').textContent = '岗位能力知识图谱 · ' + province.name;
    const grid = document.getElementById('talent-prov-stats-grid');
    if (grid) {
        grid.innerHTML = '<div class="detail-stat"><div class="detail-stat-label">岗位数量</div><div class="detail-stat-value">' + (province.jobCount || 0).toLocaleString() + '</div></div>'
            + '<div class="detail-stat"><div class="detail-stat-label">热门指数</div><div class="detail-stat-value">' + (province.hotIndex || '--') + '</div></div>'
            + '<div class="detail-stat"><div class="detail-stat-label">增长率</div><div class="detail-stat-value" style="color:' + ((province.growthRate||0)>=0?'#8F6B0E':'#f87171') + '">' + ((province.growthRate||0)>=0?'↑':'↓') + Math.abs(province.growthRate||0) + '%</div></div>'
            + '<div class="detail-stat"><div class="detail-stat-label">平均薪资</div><div class="detail-stat-value">' + talentFormatSalary(province.avgSalary) + '</div></div>';
    }
    const topEl = document.getElementById('talent-prov-top-jobs');
    if (topEl) topEl.innerHTML = '<span class="skill-matched">AI算法</span><span class="skill-matched">数据分析</span><span class="skill-matched">后端开发</span><span class="skill-matched">前端开发</span><span class="skill-matched">运维</span>';
}
window.talentShowProvinceDetailPanel = talentShowProvinceDetailPanel;

// ============== 岗位能力知识图谱 (中心岗位 + 辐射技术节点) ==============
var techDetailState = { currentTech: null, currentCity: null, graphJobName: null, savedPanelHTML: '', savedPanelDisplay: '' };

// 节点颜色映射
var TECH_CATEGORY_COLORS = {
    "编程语言": "#2563EB",
    "框架与开发": "#7C3AED",
    "数据存储与处理": "#F59E0B",
    "数据存储": "#F59E0B",
    "存储": "#F59E0B",
    "工程化与运维": "#10B981",
    "工程化运维": "#10B981",
    "AI与算法": "#EC4899",
    "前端技术": "#06B6D4",
    "架构设计": "#8B5CF6",
    "后端技术": "#6366F1",
    "数据处理": "#E11D48",
    "测试技术": "#F97316",
    "嵌入式/硬件": "#F97316",
    "核心技能": "#6366F1",
    "通用技术": "#6366F1"
};

// AI兜底图谱数据（当API无数据时使用）—— 根据岗位名称生成差异化技术列表
function _genTechFallbackGraph(cityName, jobName) {
    jobName = jobName || cityName;
    var seed = (cityName + jobName).split('').reduce(function(s, c) { return s + c.charCodeAt(0); }, 0);
    var rng = function(max) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % max; };

    // 岗位→核心技术映射（用于兜底）
    var JOB_TECH_FALLBACK = {
        'Java': [
            { name: 'Java', freq: 10, cat: '编程语言' },
            { name: 'Spring Boot', freq: 9, cat: '框架与开发' },
            { name: 'MySQL', freq: 9, cat: '数据存储' },
            { name: 'Redis', freq: 8, cat: '数据存储' },
            { name: 'Spring MVC', freq: 7, cat: '框架与开发' },
            { name: 'Spring Cloud', freq: 6, cat: '框架与开发' },
            { name: 'Docker', freq: 6, cat: '工程化运维' },
            { name: 'Linux', freq: 7, cat: '工程化运维' },
            { name: 'Git', freq: 8, cat: '工程化运维' },
            { name: 'Maven', freq: 5, cat: '工程化运维' },
            { name: '微服务', freq: 5, cat: '架构设计' },
            { name: 'MyBatis', freq: 5, cat: '框架与开发' },
            { name: 'Kafka', freq: 4, cat: '框架与开发' },
            { name: 'SQL优化', freq: 4, cat: '数据存储' },
            { name: 'JVM', freq: 5, cat: '编程语言' },
            { name: '多线程', freq: 4, cat: '编程语言' },
            { name: 'Nginx', freq: 4, cat: '工程化运维' },
            { name: 'Elasticsearch', freq: 3, cat: '数据存储' },
        ],
        '前端': [
            { name: 'JavaScript', freq: 10, cat: '编程语言' },
            { name: 'HTML/CSS', freq: 10, cat: '前端技术' },
            { name: 'Vue', freq: 9, cat: '前端技术' },
            { name: 'React', freq: 7, cat: '前端技术' },
            { name: 'TypeScript', freq: 8, cat: '编程语言' },
            { name: 'Webpack', freq: 6, cat: '工程化运维' },
            { name: 'Vite', freq: 5, cat: '工程化运维' },
            { name: 'Git', freq: 7, cat: '工程化运维' },
            { name: 'Node.js', freq: 6, cat: '后端技术' },
            { name: 'ES6+', freq: 6, cat: '编程语言' },
            { name: 'Sass/Less', freq: 5, cat: '前端技术' },
            { name: 'Axios', freq: 5, cat: '前端技术' },
            { name: 'Element UI', freq: 5, cat: '前端技术' },
            { name: 'Ant Design', freq: 4, cat: '前端技术' },
            { name: '小程序', freq: 5, cat: '前端技术' },
            { name: 'ECharts', freq: 4, cat: '前端技术' },
        ],
        'Python': [
            { name: 'Python', freq: 10, cat: '编程语言' },
            { name: 'Pandas', freq: 9, cat: '数据处理' },
            { name: 'NumPy', freq: 8, cat: '数据处理' },
            { name: 'SQL', freq: 9, cat: '数据存储' },
            { name: 'Matplotlib', freq: 6, cat: '数据处理' },
            { name: 'Scikit-learn', freq: 7, cat: 'AI与算法' },
            { name: 'PyTorch', freq: 5, cat: 'AI与算法' },
            { name: 'Django', freq: 5, cat: '框架与开发' },
            { name: 'Flask', freq: 4, cat: '框架与开发' },
            { name: 'Git', freq: 7, cat: '工程化运维' },
            { name: 'Docker', freq: 5, cat: '工程化运维' },
            { name: 'Jupyter', freq: 5, cat: '工程化运维' },
            { name: '数据清洗', freq: 6, cat: '数据处理' },
            { name: '数据可视化', freq: 5, cat: '数据处理' },
        ],
        '测试': [
            { name: 'Python', freq: 7, cat: '编程语言' },
            { name: 'Selenium', freq: 8, cat: '测试技术' },
            { name: 'JMeter', freq: 7, cat: '测试技术' },
            { name: 'Postman', freq: 6, cat: '测试技术' },
            { name: 'SQL', freq: 7, cat: '数据存储' },
            { name: 'Git', freq: 7, cat: '工程化运维' },
            { name: 'Linux', freq: 6, cat: '工程化运维' },
            { name: 'Jenkins', freq: 5, cat: '工程化运维' },
            { name: '自动化测试', freq: 8, cat: '测试技术' },
            { name: '性能测试', freq: 6, cat: '测试技术' },
            { name: 'Appium', freq: 4, cat: '测试技术' },
            { name: 'Bug管理', freq: 5, cat: '测试技术' },
        ],
        '运维': [
            { name: 'Linux', freq: 10, cat: '工程化运维' },
            { name: 'Docker', freq: 9, cat: '工程化运维' },
            { name: 'Kubernetes', freq: 8, cat: '工程化运维' },
            { name: 'Shell', freq: 8, cat: '编程语言' },
            { name: 'Python', freq: 7, cat: '编程语言' },
            { name: 'MySQL', freq: 7, cat: '数据存储' },
            { name: 'Redis', freq: 6, cat: '数据存储' },
            { name: 'Nginx', freq: 7, cat: '工程化运维' },
            { name: 'Git', freq: 7, cat: '工程化运维' },
            { name: 'Jenkins', freq: 6, cat: '工程化运维' },
            { name: 'Prometheus', freq: 5, cat: '工程化运维' },
            { name: 'Ansible', freq: 4, cat: '工程化运维' },
        ],
    };

    // 匹配岗位类型
    var matchedKey = null;
    var matchedLen = 0;
    Object.keys(JOB_TECH_FALLBACK).forEach(function(k) {
        if (jobName.toLowerCase().indexOf(k.toLowerCase()) !== -1 && k.length > matchedLen) {
            matchedKey = k;
            matchedLen = k.length;
        }
    });

    // 使用匹配的技术集，或通用技术集
    var techPool = (matchedKey && JOB_TECH_FALLBACK[matchedKey]) || [
        { name: 'Java', freq: 8, cat: '编程语言' },
        { name: 'Python', freq: 7, cat: '编程语言' },
        { name: 'JavaScript', freq: 6, cat: '编程语言' },
        { name: 'TypeScript', freq: 4, cat: '编程语言' },
        { name: 'Spring Boot', freq: 7, cat: '框架与开发' },
        { name: 'Vue', freq: 6, cat: '框架与开发' },
        { name: 'React', freq: 5, cat: '框架与开发' },
        { name: 'MySQL', freq: 8, cat: '数据存储' },
        { name: 'Redis', freq: 7, cat: '数据存储' },
        { name: 'MongoDB', freq: 3, cat: '数据存储' },
        { name: 'Docker', freq: 6, cat: '工程化运维' },
        { name: 'Git', freq: 8, cat: '工程化运维' },
        { name: 'Linux', freq: 7, cat: '工程化运维' },
        { name: 'Node.js', freq: 4, cat: '后端技术' },
        { name: 'PyTorch', freq: 3, cat: 'AI与算法' },
        { name: 'Pandas', freq: 3, cat: '数据处理' },
        { name: 'HTML/CSS', freq: 5, cat: '前端技术' },
    ];

    // 随机打乱并选择固定数量（根据城市hash差异化）
    var shuffled = techPool.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
        var j = rng(i + 1);
        var tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
    }

    var count = Math.min(shuffled.length, 14 + (rng(5)));
    var selected = shuffled.slice(0, count);

    // 统计最大频率
    var maxFreq = 0;
    selected.forEach(function(t) { if (t.freq > maxFreq) maxFreq = t.freq; });

    // 按类别分组
    var catMap = {};
    selected.forEach(function(t) {
        if (!catMap[t.cat]) catMap[t.cat] = { name: t.cat, technologies: [] };
        var size = 16 + Math.floor((t.freq / maxFreq) * 26);
        catMap[t.cat].technologies.push({
            name: t.name,
            size: Math.min(size, 42),
            frequency: t.freq,
            ratio: maxFreq ? t.freq / maxFreq : 0.5
        });
    });

    var categories = [];
    Object.keys(catMap).forEach(function(k) {
        if (catMap[k].technologies.length > 0) categories.push(catMap[k]);
    });

    return {
        cityName: cityName,
        centerJob: jobName,
        totalJobs: 20,
        uniqueTitles: 18,
        realJobCount: 0,
        isSupplemented: true,
        isFallback: true,
        jobs: [],
        categories: categories,
        maxFrequency: maxFreq
    };
}


// ==================================================================
// 技术栈视图专用布局：中心岗位 + 固定分类扇区 + 分类下技术卡片
// 结构：中心 → 一级技术分类（环状固定扇区）→ 二级技术节点（扇区内由内向外逐层排布）
// 特点：分类区域固定、技术卡片统一尺寸、层内按弧长自动分配、层间固定行距，
//       全程不依赖自由力导向，节点数量多时自动扩大布局半径，保证不重叠
// ==================================================================
function _layoutStackView(groupNodes, centerX, centerY, w, h) {
    var n = groupNodes.length;
    if (!n) return;

    // ============ 横向分区布局（不再强制圆形，左右展开） ============
    // 空间分配：左分类列 —— 中心岗位 —— 右分类列。
    // 盒子宽度按分类内容自适应（大分类 3 列卡片、中分类 2 列、小分类 1 列），
    // 行内并排、行高取 max，尽量压低总高，让 fitView 缩放接近 1:1、字号清晰。
    var cardH = 32;          // 技术卡片高
    var cardGapX = 12;       // 卡片水平间距
    var cardGapY = 8;        // 卡片垂直间距
    var catPadX = 14;        // 分类盒左右内边距
    var catPadY = 10;        // 分类盒上下内边距
    var catTitleH = 32;      // 分类标题条高
    var rowGap = 24;         // 分类行间距
    var colGap = 24;         // 行内盒子间距
    var centerZoneW = 150;   // 中心节点区域横向宽度（含两侧连线空隙）
    var sidePad = 20;        // 画布左右边距

    // 1) 卡片宽度：长名称自适应加宽（字号 15px 时保证名称完整、文字不溢出）
    groupNodes.forEach(function(g) {
        g.techs.forEach(function(t) {
            t.cardW = Math.max(118, Math.ceil(t.name.length * 8.5 + 34));
        });
    });

    // 2) 左右分组：大分类（≥8 技术）左右交替保证两侧均衡，其余按技术数量贪心均衡
    var lefts = [], rights = [];
    groupNodes.slice()
        .sort(function(a, b) { return b.techs.length - a.techs.length; })
        .forEach(function(g, i) {
            if (g.techs.length >= 8) {
                if (i % 2 === 0) { lefts.push(g); g.side = 'L'; }
                else { rights.push(g); g.side = 'R'; }
            }
        });
    var remain = groupNodes.filter(function(g) { return !g.side; })
        .sort(function(a, b) { return b.techs.length - a.techs.length; });
    var lCount = lefts.reduce(function(s, g) { return s + g.techs.length; }, 0);
    var rCount = rights.reduce(function(s, g) { return s + g.techs.length; }, 0);
    remain.forEach(function(g) {
        if (lCount <= rCount) { lefts.push(g); g.side = 'L'; lCount += g.techs.length; }
        else { rights.push(g); g.side = 'R'; rCount += g.techs.length; }
    });
    // 兜底：某侧为空则强制交替平分
    if (!lefts.length || !rights.length) {
        var allMix = lefts.concat(rights);
        lefts = []; rights = [];
        allMix.forEach(function(g, i) {
            g.side = (i % 2 === 0) ? 'L' : 'R';
            (g.side === 'L' ? lefts : rights).push(g);
        });
    }
    var sideW = Math.max(180, (w - centerZoneW - sidePad * 2) / 2);

    // 3) 分类盒布局：盒宽按内容自适应 + 行内并排 + 行高取 max
    function layoutSide(list, sw) {
        list.forEach(function(cat) {
            var m = cat.techs.length;
            var maxW = 0;
            cat.techs.forEach(function(t) { if (t.cardW > maxW) maxW = t.cardW; });
            var cols = m >= 8 ? 3 : (m >= 4 ? 2 : 1);
            var needW = cols * maxW + (cols - 1) * cardGapX + catPadX * 2;
            var boxW = Math.min(sw, needW);
            while (cols > 1 && cols * maxW + (cols - 1) * cardGapX + catPadX * 2 > boxW + 1e-6) cols--;
            var rowsN = Math.max(1, Math.ceil(m / cols));
            cat._cols = cols;
            cat._rowsN = rowsN;
            cat.boxW = boxW;
            cat.boxH = catTitleH + rowsN * (cardH + cardGapY) + catPadY * 2 - cardGapY;
        });
        // 行内并排贪心（每行盒子总宽 ≤ 侧区宽）
        var rows = [], cur = [], curW = 0;
        list.forEach(function(cat) {
            if (cur.length && curW + colGap + cat.boxW > sw + 0.5) {
                rows.push(cur); cur = [cat]; curW = cat.boxW;
            } else {
                cur.push(cat); curW += (cur.length ? colGap : 0) + cat.boxW;
            }
        });
        if (cur.length) rows.push(cur);
        var rowHs = [], rowWs = [];
        rows.forEach(function(row) {
            var mh = 0, mw = 0;
            row.forEach(function(c) {
                if (c.boxH > mh) mh = c.boxH;
                mw += c.boxW;
            });
            mw += (row.length - 1) * colGap;
            rowHs.push(mh);
            rowWs.push(mw);
        });
        var totalH = rowHs.reduce(function(s, v) { return s + v; }, 0) + (rows.length - 1) * rowGap;
        return { rows: rows, rowHs: rowHs, totalH: totalH, totalW: Math.max.apply(null, rowWs) || 0 };
    }
    var L = layoutSide(lefts, sideW);
    var R = layoutSide(rights, sideW);
    var totalH = Math.max(L.totalH, R.totalH);

    // 4) 放置：左列顶左、右列顶右，中心节点位于正中；两列垂直居中于容器中线
    var leftY0 = centerY - L.totalH / 2;
    var rightY0 = centerY - R.totalH / 2;
    var leftX = sidePad;
    var rightX = w - sidePad - R.totalW;

    function placeSide(list, res, x0, y0) {
        var idx = 0, rowY = y0;
        for (var r = 0; r < res.rows.length; r++) {
            var row = res.rows[r];
            var rowH = res.rowHs[r];
            var bx = x0;
            row.forEach(function(cat) {
                var bW = cat.boxW;
                var bH = cat.boxH;
                var by = rowY + (rowH - bH) / 2;
                // 盒内卡片：固定列数逐行填充，行内居中
                var yy = catPadY + catTitleH;
                for (var rowIdx = 0; rowIdx < cat._rowsN; rowIdx++) {
                    var rowStart = rowIdx * cat._cols;
                    var rowEnd = Math.min(cat._cols, cat.techs.length - rowStart);
                    var rowW = 0;
                    for (var k = 0; k < rowEnd; k++) {
                        rowW += cat.techs[rowStart + k].cardW + (k > 0 ? cardGapX : 0);
                    }
                    var xx = (bW - rowW) / 2;
                    for (var k = 0; k < rowEnd; k++) {
                        var t = cat.techs[rowStart + k];
                        t.cardX = xx;
                        t.cardY = yy;
                        xx += t.cardW + cardGapX;
                    }
                    yy += cardH + cardGapY;
                }
                // 分类盒位置（背景框 + 标题条）
                cat.boxX = bx;
                cat.boxY = by;
                cat.boxW = bW;
                cat.boxH = bH;
                cat.catTitleH = catTitleH;
                cat.calcX = bx + bW / 2;      // 标题条中心
                cat.calcY = by + catTitleH / 2;
                // 技术卡片全局坐标
                cat.techs.forEach(function(t) {
                    t.calcX = bx + t.cardX + t.cardW / 2;
                    t.calcY = by + t.cardY + cardH / 2;
                });
                bx += bW + colGap;
            });
            rowY += rowH + rowGap;
        }
    }
    placeSide(lefts, L, leftX, leftY0);
    placeSide(rights, R, rightX, rightY0);

    // 清理临时字段
    groupNodes.forEach(function(g) { delete g._cols; delete g._rowsN; });
}

// 岗位技术图谱三视图：'overview' = 岗位技术图谱（中心=岗位，二级=技术）
//                   'stack'   = 技术栈（中心=岗位，二级=技术分类，三级=技术）
//                   'level'   = 级别（中心=岗位，二级=岗位级别，三级=技术）
// 三个视图共用同一套岗位级真实数据（/api/map/job-tech-graph/），切换不重复请求、不刷新页面
window.renderCityTechGraph = async function(cityName, jobName, keepMode, viewMode) {
    var container = document.getElementById('talent-graph-container');
    if (!container) return;
    if (container.clientWidth < 10 || container.clientHeight < 10) {
        setTimeout(function() { window.renderCityTechGraph(cityName, jobName, keepMode, viewMode); }, 150);
        return;
    }
    // 记录当前图谱上下文（供视图切换复用）
    techDetailState.graphCity = cityName;
    techDetailState.graphJob = jobName || null;
    if (!keepMode) techDetailState.graphView = 'overview'; // 每次进入默认显示岗位技术图谱
    var view = viewMode || techDetailState.graphView || 'overview';
    techDetailState.graphView = view;
    // 销毁旧实例
    if (talentMapState.jobGraphInstance) {
        try { talentMapState.jobGraphInstance.destroy(); } catch(e) {}
        talentMapState.jobGraphInstance = null;
    }
    try {
        await window.ensureG6();
    } catch (e) {
        container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#fff;font-size:14px">图谱库加载失败，请检查网络后重试</div>';
        return;
    }
    if (typeof G6 === 'undefined' || !G6.Graph) {
        container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#fff;font-size:14px">G6图谱库加载中，请稍后重试...</div>';
        return;
    }

    // 标签文案：进入图谱后聚焦当前岗位（不再展示城市级）
    var labelText = jobName || cityName;
    var cityLabelEl = document.getElementById('talent-graph-city-label');
    if (cityLabelEl) cityLabelEl.textContent = labelText + ' · ' + ({ overview: '岗位技术图谱', stack: '技术栈', level: '级别' }[view] || '岗位技术图谱');
    techDetailState.currentCity = cityName;
    // 保存用于图谱的岗位名
    techDetailState.graphJobName = jobName || cityName;

    // 获取图谱数据：优先使用缓存（视图切换平滑无闪烁），否则请求后端岗位级API
    if (!techDetailState.graphDataCache) techDetailState.graphDataCache = {};
    var cacheKey = 'job|' + (jobName || '') + '|' + view;
    var graphData = techDetailState.graphDataCache[cacheKey];
    if (!graphData) {
        container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,.5);font-size:13px">正在生成' + labelText + '技术知识图谱...</div>';
        try {
            var apiUrl = API_BASE + '/map/job-tech-graph/?job_title=' + encodeURIComponent(jobName || cityName);
            var res = await fetch(apiUrl);
            var json = await res.json();
            graphData = (json.data || json);
            techDetailState.graphDataCache[cacheKey] = graphData;
        } catch(e) {
            console.warn('[TechGraph] API失败', e);
        }
    }

    // 兜底：岗位级真实数据不足时使用岗位级兜底（不再使用城市级数据）
    if (!graphData || !graphData.categories || !graphData.categories.length) {
        console.warn('[TechGraph] 真实数据不足，使用岗位级兜底数据');
        graphData = _genTechFallbackGraph(cityName, jobName || cityName);
        techDetailState.graphDataCache[cacheKey] = graphData;
    }

    // 中心节点文案：始终为当前岗位名称
    var centerJob = graphData.centerJob || jobName || cityName;

    container.innerHTML = '';
    var w = container.clientWidth;
    var h = container.clientHeight;
    var centerX = w / 2;
    var centerY = h / 2;

    // ========== 构建节点和边 ==========
    // overview：中心岗位 + 直接连接所有技术（单层级）
    // stack  ：中心岗位 + 技术分类（二级） + 技术（三级）
    // level  ：中心岗位 + 岗位级别（二级） + 技术（三级）
    var nodes = [];
    var edges = [];
    var nodeIdCounter = 0;
    var TECH_CATEGORY_COLORS_MAP = TECH_CATEGORY_COLORS || {};

    // 待布局的技术节点（overview 直接挂中心，stack/level 挂二级节点）
    var allTechNodes = [];

    // overview：扁平化所有类别技术，直接连中心
    if (view === 'overview') {
        graphData.categories.forEach(function(cat) {
            (cat.technologies || []).forEach(function(tech) {
                var catColor = TECH_CATEGORY_COLORS_MAP[cat.name] || '#6366F1';
                allTechNodes.push({
                    name: tech.name,
                    size: tech.size || 24,
                    frequency: tech.frequency || 1,
                    ratio: tech.ratio || 0.5,
                    catColor: catColor,
                    catName: cat.name,
                    parentId: 'center'
                });
            });
        });
        // 如果技术节点过少，追加通用技术
        if (allTechNodes.length < 8) {
            var extraTechs = ['Git', 'Linux', 'Docker', 'MySQL', 'Redis', 'Python', 'Java', 'JavaScript', 'Vue'];
            for (var ei = 0; ei < extraTechs.length && allTechNodes.length < 15; ei++) {
                var alreadyExists = allTechNodes.some(function(t) { return t.name === extraTechs[ei]; });
                if (!alreadyExists) {
                    allTechNodes.push({ name: extraTechs[ei], size: 20, frequency: 3, ratio: 0.4, catColor: '#6366F1', catName: '通用技术', parentId: 'center' });
                }
            }
        }
    }

    // stack / level：构建二级中间节点 + 三级技术节点
    var groupNodes = []; // 二级节点（分类 / 级别）
    if (view === 'stack') {
        graphData.categories.forEach(function(cat) {
            if (!cat.technologies || !cat.technologies.length) return;
            var gId = 'grp-' + nodeIdCounter++;
            var techs = cat.technologies.map(function(tech) {
                var catColor = TECH_CATEGORY_COLORS_MAP[cat.name] || '#6366F1';
                allTechNodes.push({
                    name: tech.name, size: tech.size || 24, frequency: tech.frequency || 1,
                    ratio: tech.ratio || 0.5, catColor: catColor, catName: cat.name, parentId: gId
                });
                return allTechNodes[allTechNodes.length - 1];
            });
            groupNodes.push({
                id: gId, name: cat.name, size: 40, type: 'category',
                catColor: TECH_CATEGORY_COLORS_MAP[cat.name] || '#6366F1', catName: cat.name,
                techs: techs, childCount: techs.length
            });
        });
    } else if (view === 'level') {
        (graphData.levels || []).forEach(function(lv) {
            if (!lv.technologies || !lv.technologies.length) return;
            var gId = 'grp-' + nodeIdCounter++;
            var lvColor = ({ '初级': '#4ADE80', '中级': '#FBBF24', '高级': '#F472B6' })[lv.name] || '#60A5FA';
            var techs = lv.technologies.map(function(tech) {
                allTechNodes.push({
                    name: tech.name, size: tech.size || 24, frequency: tech.frequency || 1,
                    ratio: tech.ratio || 0.5, catColor: lvColor, catName: lv.name, parentId: gId
                });
                return allTechNodes[allTechNodes.length - 1];
            });
            groupNodes.push({
                id: gId, name: lv.name, size: 42, type: 'level',
                catColor: lvColor, catName: lv.name, levelName: lv.name,
                techs: techs, childCount: techs.length
            });
        });
    }

    // ========== 布局 ==========
    var maxRadius = Math.min(w, h) * 0.42;
    var minRadius = Math.min(w, h) * 0.16;

    if (view === 'overview') {
        // ---------- 径向布局（单层级，技术直接挂中心） ----------
        var maxFreq = 0;
        allTechNodes.forEach(function(t) { if (t.frequency > maxFreq) maxFreq = t.frequency; });
        allTechNodes.sort(function(a, b) { return b.frequency - a.frequency; });
        var totalTechs = allTechNodes.length;
        var rings = [];
        if (totalTechs <= 10) {
            rings = [totalTechs];
        } else if (totalTechs <= 20) {
            var inner = Math.ceil(totalTechs * 0.4);
            rings = [inner, totalTechs - inner];
        } else {
            var r1 = Math.ceil(totalTechs * 0.33);
            var r2 = Math.ceil(totalTechs * 0.33);
            rings = [r1, r2, totalTechs - r1 - r2];
        }
        var ringRadii = [];
        if (rings.length === 1) {
            ringRadii = [maxRadius * 0.55];
        } else if (rings.length === 2) {
            ringRadii = [maxRadius * 0.42, maxRadius * 0.78];
        } else {
            ringRadii = [maxRadius * 0.3, maxRadius * 0.58, maxRadius * 0.82];
        }
        var idx = 0;
        for (var ringIdx = 0; ringIdx < rings.length; ringIdx++) {
            var countInRing = rings[ringIdx];
            if (countInRing <= 0) continue;
            var ringRadius = ringRadii[ringIdx];
            var angleOffset = (ringIdx % 2 === 1) ? Math.PI / countInRing : 0;
            for (var i = 0; i < countInRing && idx < totalTechs; i++) {
                var tech = allTechNodes[idx];
                var angle = angleOffset + (2 * Math.PI * i) / countInRing;
                tech.calcX = centerX + ringRadius * Math.cos(angle);
                tech.calcY = centerY + ringRadius * Math.sin(angle);
                idx++;
            }
        }
        // 重叠消除
        for (var iter = 0; iter < 8; iter++) {
            for (var i = 0; i < totalTechs; i++) {
                for (var j = i + 1; j < totalTechs; j++) {
                    var a = allTechNodes[i], b = allTechNodes[j];
                    var dx = b.calcX - a.calcX, dy = b.calcY - a.calcY;
                    var dist = Math.sqrt(dx * dx + dy * dy);
                    var minD = (a.size + b.size) * 0.48;
                    if (dist < minD && dist > 0.001) {
                        var force = (minD - dist) / dist * 0.4;
                        a.calcX -= dx * force; a.calcY -= dy * force;
                        b.calcX += dx * force; b.calcY += dy * force;
                    }
                }
            }
            for (var i = 0; i < totalTechs; i++) {
                var t = allTechNodes[i];
                var ddx = t.calcX - centerX, ddy = t.calcY - centerY;
                var currR = Math.sqrt(ddx * ddx + ddy * ddy);
                if (currR < 0.01) { t.calcX = centerX + 1; t.calcY = centerY + 1; currR = 1; }
                var targetR = Math.max(minRadius, Math.min(maxRadius * 1.05, currR));
                t.calcX = centerX + (ddx / currR) * (currR * 0.7 + targetR * 0.3);
                t.calcY = centerY + (ddy / currR) * (currR * 0.7 + targetR * 0.3);
            }
        }
    } else if (view === 'stack') {
        // ---------- 技术栈：中心 + 固定分类扇区 + 分类下技术卡片（结构化布局，无自由力导向） ----------
        _layoutStackView(groupNodes, centerX, centerY, w, h);
    } else {
        // ---------- 级别（level）：二级放射 + 三级围绕 ----------
        var groupCount = groupNodes.length;
        var groupRadius = Math.min(w, h) * 0.30;
        // 二级节点围绕中心放射
        groupNodes.forEach(function(g, gi) {
            var gAngle = (2 * Math.PI * gi) / groupCount - Math.PI / 2;
            g.calcX = centerX + groupRadius * Math.cos(gAngle);
            g.calcY = centerY + groupRadius * Math.sin(gAngle);
        });
        // 三级技术节点围绕各自二级节点放射
        groupNodes.forEach(function(g) {
            var gc = g.techs.length;
            g.childRing = Math.min(w, h) * 0.16 + g.childCount * 2;
            g.techs.forEach(function(tech, ti) {
                var tAngle = (2 * Math.PI * ti) / Math.max(gc, 1) + (g.id.length % 7) * 0.3;
                tech.calcX = g.calcX + g.childRing * Math.cos(tAngle);
                tech.calcY = g.calcY + g.childRing * Math.sin(tAngle);
            });
        });
        // 三级节点重叠消除（仅同组内部）
        for (var iter = 0; iter < 6; iter++) {
            groupNodes.forEach(function(g) {
                for (var i = 0; i < g.techs.length; i++) {
                    for (var j = i + 1; j < g.techs.length; j++) {
                        var a = g.techs[i], b = g.techs[j];
                        var dx = b.calcX - a.calcX, dy = b.calcY - a.calcY;
                        var dist = Math.sqrt(dx * dx + dy * dy);
                        var minD = (a.size + b.size) * 0.5;
                        if (dist < minD && dist > 0.001) {
                            var force = (minD - dist) / dist * 0.5;
                            a.calcX -= dx * force; a.calcY -= dy * force;
                            b.calcX += dx * force; b.calcY += dy * force;
                        }
                    }
                }
                // 把三级节点拉回二级节点附近
                g.techs.forEach(function(tech) {
                    var ddx = tech.calcX - g.calcX, ddy = tech.calcY - g.calcY;
                    var r = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
                    var target = g.childRing;
                    tech.calcX = g.calcX + (ddx / r) * (r * 0.6 + target * 0.4);
                    tech.calcY = g.calcY + (ddy / r) * (r * 0.6 + target * 0.4);
                });
            });
        }
        // 二级节点重叠消除（组间）
        for (var iter2 = 0; iter2 < 5; iter2++) {
            for (var i = 0; i < groupNodes.length; i++) {
                for (var j = i + 1; j < groupNodes.length; j++) {
                    var a = groupNodes[i], b = groupNodes[j];
                    var dx = b.calcX - a.calcX, dy = b.calcY - a.calcY;
                    var dist = Math.sqrt(dx * dx + dy * dy);
                    var minD = (a.size + b.size) * 0.8 + 40;
                    if (dist < minD && dist > 0.001) {
                        var force = (minD - dist) / dist * 0.5;
                        a.calcX -= dx * force; a.calcY -= dy * force;
                        b.calcX += dx * force; b.calcY += dy * force;
                    }
                }
            }
            groupNodes.forEach(function(g) {
                var ddx = g.calcX - centerX, ddy = g.calcY - centerY;
                var r = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
                g.calcX = centerX + (ddx / r) * (r * 0.6 + groupRadius * 0.4);
                g.calcY = centerY + (ddy / r) * (r * 0.6 + groupRadius * 0.4);
            });
        }
    }

    // 中心节点：增强科技感（双层光环 + 强发光 + 双行标题）
    var isStackView = view === 'stack';
    nodes.push({
        id: 'center-halo',
        label: '',
        type: 'decor',
        x: centerX,
        y: centerY,
        size: isStackView ? 132 : 88,
        baseSize: isStackView ? 132 : 88,
        style: {
            fill: 'rgba(255,255,255,0)',
            stroke: 'rgba(212,175,55,.28)',
            lineWidth: 1.6,
            lineDash: [6, 5],
            shadowColor: 'rgba(212,175,55,.5)',
            shadowBlur: 18
        }
    });
    var centerStyle = {
        fill: 'l(0) 0:#D9A92E 1:#F0C75C',
        stroke: '#A87B1E',
        lineWidth: 4,
        shadowColor: 'rgba(212,175,55,.8)',
        shadowBlur: 32
    };
    nodes.push({
        id: 'center',
        label: isStackView ? (centerJob + '\n技术栈总览') : centerJob,
        type: 'center',
        x: centerX,
        y: centerY,
        size: isStackView ? 78 : 68,
        baseSize: isStackView ? 78 : 68,
        style: centerStyle,
        baseStyle: centerStyle,
        labelCfg: {
            position: 'center',
            style: { fill: '#fff', fontSize: isStackView ? 14 : 13, fontWeight: 700, fontFamily: 'var(--font-sans),sans-serif', textAlign: 'center', lineHeight: 22 }
        }
    });

    // 二级中间节点（技术栈=分类卡片区域：半透明背景盒 + 顶部标题条；级别=岗位级别圆点）
    groupNodes.forEach(function(g) {
        var isCatCard = view === 'stack';
        if (isCatCard && g.boxW && g.boxH) {
            // 分类区域背景盒（深色半透明科技风，置于最底层，Hover 不影响）
            nodes.push({
                id: g.id + '-box',
                label: '',
                type: 'rect',
                boxNode: true,
                x: g.boxX + g.boxW / 2,
                y: g.boxY + g.boxH / 2,
                size: [g.boxW, g.boxH],
                style: {
                    fill: 'rgba(8,16,28,.42)',
                    stroke: g.catColor,
                    lineWidth: 1.4,
                    radius: 14,
                    shadowColor: 'rgba(212,175,55,.16)',
                    shadowBlur: 14
                }
            });
        }
        var catSize = isCatCard ? [g.boxW || g.catW || 140, g.catTitleH || g.catH || 38] : g.size;
        var catStyle = {
            fill: isCatCard ? ('l(0) 0:' + g.catColor + ' 1:rgba(26,24,20,.82)') : g.catColor,
            stroke: isCatCard ? 'rgba(255,235,180,.75)' : 'rgba(255,235,180,.6)',
            lineWidth: isCatCard ? 2.5 : 2.5,
            radius: isCatCard ? 12 : 0,
            shadowColor: 'rgba(212,175,55,.5)',
            shadowBlur: isCatCard ? 14 : 14
        };
        nodes.push({
            id: g.id,
            label: isCatCard ? ('◆ ' + g.name) : g.name,
            type: isCatCard ? 'rect' : g.type,
            x: g.calcX,
            y: g.calcY,
            size: catSize,
            baseSize: Array.isArray(catSize) ? catSize.slice() : catSize,
            catColor: g.catColor,
            catName: g.catName,
            style: catStyle,
            baseStyle: catStyle,
            labelCfg: {
                position: 'center',
                style: { fill: '#fff', fontSize: isCatCard ? 17 : 12, fontWeight: 700, fontFamily: 'var(--font-sans),sans-serif', textShadowColor: 'rgba(0,0,0,.4)', textShadowBlur: 3 }
            }
        });
        // 中心 → 分类连线（技术栈视图稍粗、更亮，形成主骨架）
        edges.push({
            id: 'edge-center-' + g.id,
            source: 'center',
            target: g.id,
            type: 'line',
            style: isCatCard
                ? { stroke: 'rgba(240,199,92,.55)', lineWidth: 2, lineDash: [6, 4], endArrow: false }
                : { stroke: 'rgba(212,175,55,.32)', lineWidth: 1.4, lineDash: [4, 3], endArrow: false }
        });
    });

    // 技术节点（技术栈视图 = 统一尺寸圆角科技卡片，名称居中显示；其他视图 = 圆点）
    allTechNodes.forEach(function(tech, i) {
        var techId = 'tech-' + i;
        var nodeFill = tech.catColor;
        var techSize, techBase;
        if (view === 'stack') {
            // 卡片统一高度，宽度按名称长度自动适配（长名称加宽、不影响间距防重叠）
            techSize = [tech.cardW || 112, 38];
            techBase = techSize.slice();
        } else {
            techSize = tech.size;
            techBase = tech.size;
        }
        var techStyle = {
            fill: view === 'stack' ? ('l(0) 0:' + nodeFill + ' 1:rgba(20,18,15,.85)') : nodeFill,
            stroke: 'rgba(255,235,180,.6)',
            lineWidth: view === 'stack' ? 1.6 : 2,
            radius: view === 'stack' ? 11 : 0,
            shadowColor: 'rgba(212,175,55,.3)',
            shadowBlur: view === 'stack' ? 9 : 8
        };
        nodes.push({
            id: techId,
            label: tech.name,
            type: view === 'stack' ? 'rect' : 'technology',
            isTech: true,
            x: tech.calcX,
            y: tech.calcY,
            size: techSize,
            baseSize: techBase,
            frequency: tech.frequency,
            ratio: tech.ratio,
            catColor: tech.catColor,
            style: techStyle,
            baseStyle: techStyle,
            labelCfg: {
                position: view === 'stack' ? 'center' : 'bottom',
                offset: view === 'stack' ? 0 : 3,
                style: { fill: '#fff', fontSize: view === 'stack' ? 15 : 10, fontWeight: view === 'stack' ? 600 : 500, fontFamily: 'var(--font-sans),sans-serif', textShadowColor: 'rgba(0,0,0,.55)', textShadowBlur: 4 }
            }
        });
        // 边：overview 直接连中心；stack/level 连所属二级节点
        edges.push({
            id: 'edge-parent-' + techId,
            source: tech.parentId || 'center',
            target: techId,
            type: 'line',
            style: view === 'stack'
                ? { stroke: 'rgba(212,175,55,.4)', lineWidth: 1.1, lineDash: [3, 3], endArrow: false }
                : { stroke: 'rgba(212,175,55,.3)', lineWidth: 1, lineDash: [4, 3], endArrow: false }
        });
    });

    // ========== 技术节点之间的关联边（同类别自动关联，真实数据驱动，控制数量防杂乱） ==========
    // 技术栈视图为规整卡片布局，技术间曲线会穿插卡片，故不生成技术间关联边
    if (view !== 'stack') {
    // 同一技术类别内的节点互相连接（形成技术簇），且频率接近的节点优先关联
    var catGroups = {};
    allTechNodes.forEach(function(t, i) {
        if (!catGroups[t.catName]) catGroups[t.catName] = [];
        catGroups[t.catName].push({ idx: i, freq: t.frequency });
    });
    var linkEdgeId = 0;
    Object.keys(catGroups).forEach(function(cat) {
        var group = catGroups[cat];
        if (!group || group.length < 2) return;
        // 按频率降序，优先高频节点关联
        group.sort(function(a, b) { return b.freq - a.freq; });
        // 每类最多建立 3 条关联（取频率最高的前 4 个节点两两相连）
        var maxLink = Math.min(group.length - 1, 3);
        for (var li = 0; li < maxLink; li++) {
            var src = group[li].idx;
            var tgt = group[li + 1].idx;
            if (src === tgt) continue;
            var bendDir = (li % 2 === 0) ? 1 : -1;
            edges.push({
                id: 'link-' + (linkEdgeId++),
                source: 'tech-' + src,
                target: 'tech-' + tgt,
                type: 'quadratic',
                style: { stroke: 'rgba(255,214,102,.35)', lineWidth: 1.2, curveOffset: 22 * bendDir, curvePosition: 0.5, endArrow: false }
            });
        }
    });
    }

    try {
        talentMapState.jobGraphInstance = new G6.Graph({
            container: 'talent-graph-container',
            width: w,
            height: h,
            modes: { default: [] },
            layout: false,  // 使用预计算位置，不做自动布局
            animate: true,
            animateCfg: { duration: 800 },
            defaultNode: {
                type: 'circle',
                labelCfg: {
                    position: 'bottom',
                    offset: 5,
                    style: { fill: '#fff', fontSize: 10, fontWeight: 500, fontFamily: 'var(--font-sans),sans-serif' }
                }
            },
            defaultEdge: {
                type: 'cubic',
                style: { stroke: 'rgba(255,214,102,.25)', lineWidth: 1, endArrow: false }
            },
            nodeStateStyles: {
                // active 显式指定深色半透明背景，防止 Hover 后背景变白导致文字看不清
                active: {
                    fill: 'rgba(16,36,52,.96)',
                    lineWidth: 3,
                    stroke: '#FFD666',
                    shadowColor: 'rgba(255,214,102,.9)',
                    shadowBlur: 24
                },
                linked: {
                    lineWidth: 2,
                    stroke: 'rgba(255,214,102,.75)',
                    shadowColor: 'rgba(255,214,102,.4)',
                    shadowBlur: 12
                },
                inactive: { opacity: 0.12 }
            },
            edgeStateStyles: {
                active: { stroke: '#FFD666', lineWidth: 2, opacity: 1, shadowColor: 'rgba(255,214,102,.8)', shadowBlur: 10 },
                linked: { stroke: 'rgba(255,214,102,.6)', lineWidth: 1.4, opacity: 0.85 },
                inactive: { opacity: 0.06 }
            }
        });

        talentMapState.jobGraphInstance.data({ nodes: nodes, edges: edges });
        talentMapState.jobGraphInstance.render();

        // fitView 确保所有节点可见（padding 收紧，横向布局下缩放更接近 1:1，字号更清晰）
        setTimeout(function() {
            if (talentMapState.jobGraphInstance && talentMapState.jobGraphInstance.fitView) {
                talentMapState.jobGraphInstance.fitView(28);
            }
        }, 500);

        // 技术节点点击 → 右侧技术详情
        talentMapState.jobGraphInstance.on('node:click', function(evt) {
            var model = evt.item && evt.item.getModel ? evt.item.getModel() : null;
            if (!model || !model.isTech) return;
            window.renderTechDetail(model.label || model.id, model.frequency, model.ratio);
        });

        // 鼠标悬浮tooltip
        var tooltipEl = document.createElement('div');
        tooltipEl.className = 'tech-node-tooltip';
        tooltipEl.style.cssText = 'display:none;position:absolute;z-index:1000;background:rgba(10,14,34,.95);color:#fff;padding:9px 15px;border-radius:10px;font-size:12px;pointer-events:none;white-space:nowrap;border:1px solid rgba(212,175,55,.45);box-shadow:0 6px 22px rgba(0,0,0,.5),0 0 16px rgba(212,175,55,.22);backdrop-filter:blur(8px);';
        container.appendChild(tooltipEl);

        // 节点悬停联动高亮：当前节点高亮放大、关联节点/曲线高亮、非关联节点与曲线弱化
        function highlightGraph(model) {
            var graph = talentMapState.jobGraphInstance;
            if (!graph || !model) return;
            // 收集直接关联的节点与边
            var linkedNodeIds = {};
            var linkedEdgeIds = {};
            graph.getEdges().forEach(function(edge) {
                var em = edge.getModel();
                if (em.source === model.id || em.target === model.id) {
                    linkedEdgeIds[em.id] = true;
                    if (em.source !== model.id) linkedNodeIds[em.source] = true;
                    if (em.target !== model.id) linkedNodeIds[em.target] = true;
                }
            });
            // 节点状态
            graph.getNodes().forEach(function(node) {
                var nm = node.getModel();
                if (nm.type === 'decor' || nm.boxNode) return; // 装饰光环/背景盒不参与高亮弱化
                graph.clearItemStates(node, ['active', 'linked', 'inactive']);
                if (nm.id === model.id) {
                    if (nm.type !== 'center') graph.setItemState(node, 'active', true);
                    // 当前节点放大 + Hover 样式（深色半透明背景 + 金色发光边框，杜绝纯白背景）
                    if (nm.baseSize) {
                        var bz = nm.baseSize;
                        var hoverStyle = (nm.type === 'center')
                            ? { lineWidth: 4, shadowColor: 'rgba(212,175,55,.9)', shadowBlur: 36 }
                            : { fill: 'rgba(16,36,52,.96)', stroke: '#FFD666', lineWidth: 3, shadowColor: 'rgba(255,214,102,.9)', shadowBlur: 24 };
                        graph.updateItem(node, { size: Array.isArray(bz) ? [bz[0] * 1.18, bz[1] * 1.18] : bz * 1.35, style: hoverStyle });
                    }
                } else if (linkedNodeIds[nm.id]) {
                    graph.setItemState(node, 'linked', true);
                } else {
                    graph.setItemState(node, 'inactive', true);
                }
            });
            // 边状态
            graph.getEdges().forEach(function(edge) {
                var em = edge.getModel();
                graph.clearItemStates(edge, ['active', 'linked', 'inactive']);
                if (linkedEdgeIds[em.id]) {
                    graph.setItemState(edge, 'active', true);
                } else {
                    graph.setItemState(edge, 'inactive', true);
                }
            });
        }
        function resetHighlight() {
            var graph = talentMapState.jobGraphInstance;
            if (!graph) return;
            graph.getNodes().forEach(function(node) {
                var nm = node.getModel && node.getModel();
                if (!nm || nm.type === 'decor' || nm.boxNode) return;
                graph.clearItemStates(node, ['active', 'linked', 'inactive']);
                // 恢复原始尺寸与样式（避免动画/深色背景残留；卡片为数组尺寸需逐维比较）
                var patch = {};
                if (nm.baseSize) {
                    var bz = nm.baseSize;
                    var changed = Array.isArray(bz)
                        ? (nm.size && (Math.abs(nm.size[0] - bz[0]) > 0.5 || Math.abs(nm.size[1] - bz[1]) > 0.5))
                        : Math.abs(nm.size - bz) > 0.5;
                    if (changed) patch.size = bz;
                }
                if (nm.baseStyle && nm.style &&
                    (nm.style.fill !== nm.baseStyle.fill || nm.style.lineWidth !== nm.baseStyle.lineWidth || (nm.style.stroke || '') !== (nm.baseStyle.stroke || ''))) {
                    patch.style = nm.baseStyle;
                }
                if (patch.size || patch.style) graph.updateItem(node, patch);
            });
            graph.getEdges().forEach(function(edge) {
                graph.clearItemStates(edge, ['active', 'linked', 'inactive']);
            });
        }

        talentMapState.jobGraphInstance.on('node:mouseenter', function(evt) {
            var model = evt.item && evt.item.getModel ? evt.item.getModel() : null;
            if (!model || model.type === 'decor' || model.boxNode) { resetHighlight(); return; }
            highlightGraph(model);
            if (model.type === 'center') { tooltipEl.style.display = 'none'; return; }
            tooltipEl.style.display = 'block';
            if (model.isTech) {
                // 深色科技风 Tooltip：标题较大、信息适中、不遮挡节点
                var starN = Math.max(1, Math.min(5, Math.round((model.ratio || 0) * 5)));
                var stars = '★'.repeat(starN) + '☆'.repeat(5 - starN);
                tooltipEl.innerHTML = '<div style="font-size:14px;font-weight:700;color:#FFE9B0;line-height:1.5">' + model.label + '</div>'
                    + '<div style="font-size:11px;color:rgba(255,214,102,.72);margin-top:3px">需求频率: ' + (model.frequency || 0)
                    + ' · 技术热度 ' + stars + '</div>'
                    + '<div style="font-size:10px;color:rgba(255,255,255,.45);margin-top:2px">点击查看详情</div>';
            } else {
                tooltipEl.innerHTML = '<div style="font-size:13px;font-weight:600;color:#FFE9B0">' + (model.label || model.id) + '</div>';
            }
        });
        talentMapState.jobGraphInstance.on('node:mouseleave', function() {
            tooltipEl.style.display = 'none';
            resetHighlight();
        });
        talentMapState.jobGraphInstance.on('node:mousemove', function(evt) {
            tooltipEl.style.left = (evt.canvasX + 14) + 'px';
            tooltipEl.style.top = (evt.canvasY - 24) + 'px';
        });

        // 触摸设备支持
        talentMapState.jobGraphInstance.on('node:touchstart', function(evt) {
            var model = evt.item && evt.item.getModel ? evt.item.getModel() : null;
            if (!model || !model.isTech) return;
            window.renderTechDetail(model.label || model.id, model.frequency, model.ratio);
        });

    } catch(e) {
        console.warn('[TechGraph] G6渲染失败', e);
        container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,.35);font-size:13px">图谱渲染失败，请重试</div>';
    }
};

// 同步图谱切换气泡的显隐与选中态（进入岗位技术图谱后显示三个视图切换）
function talentSyncGraphToggle() {
    var toggle = document.getElementById('talent-graph-mode-toggle');
    if (!toggle) return;
    toggle.style.display = 'flex';
    var views = ['overview', 'stack', 'level'];
    views.forEach(function(v) {
        var btn = document.getElementById('talent-graph-view-' + v);
        if (btn) btn.classList.toggle('active', (techDetailState.graphView || 'overview') === v);
    });
}

// 切换岗位技术图谱三视图（overview 岗位技术图谱 / stack 技术栈 / level 级别）：
// 不刷新页面、不跳转路由，仅淡出容器 → 按新视图重绘图谱 → 淡入，保持页面整体布局不变
window.talentSetJobGraphView = function(view) {
    if (view !== 'overview' && view !== 'stack' && view !== 'level') return;
    if ((techDetailState.graphView || 'overview') === view) return;
    techDetailState.graphView = view;
    talentSyncGraphToggle();
    var container = document.getElementById('talent-graph-container');
    if (!container) return;
    container.classList.add('graph-fading');
    setTimeout(async function() {
        try {
            await window.renderCityTechGraph(techDetailState.graphCity, techDetailState.graphJob, true, view);
        } catch (e) {
            console.error('[TechGraph] 视图切换渲染失败', e);
        } finally {
            // 无论渲染成功与否，都必须移除淡出态，避免图谱永久透明/白屏
            requestAnimationFrame(function() { container.classList.remove('graph-fading'); });
        }
    }, 240);
};

// 渲染技术详情到右侧岗位分析面板（复用 #talent-detail-province）
window.renderTechDetail = async function(techName, frequency, ratio) {
    techDetailState.currentTech = techName;
    
    // 保存当前省份/城市面板内容（用于取消选择时恢复）
    if (!techDetailState.savedPanelHTML) {
        var provPanel = document.getElementById('talent-detail-province');
        techDetailState.savedPanelHTML = provPanel ? provPanel.innerHTML : '';
        techDetailState.savedPanelDisplay = provPanel ? provPanel.style.display : '';
    }
    
    var panel = document.getElementById('talent-detail-province');
    if (!panel) return;
    
    // 隐藏无关面板
    var emptyPanel = document.getElementById('talent-detail-empty');
    var hoverPanel = document.getElementById('talent-detail-hover');
    if (emptyPanel) emptyPanel.style.display = 'none';
    if (hoverPanel) hoverPanel.style.display = 'none';
    panel.style.display = 'block';
    
    panel.innerHTML = '<div class="detail-content" style="padding:20px"><p style="color:var(--text-muted);text-align:center;padding:40px 0">加载技术详情...</p></div>';
    
    // 调用后端API
    var techDetail = null;
    try {
        var url = API_BASE + '/map/tech-detail/' + encodeURIComponent(techName);
        if (techDetailState.currentCity) url += '?city_name=' + encodeURIComponent(techDetailState.currentCity);
        var res = await fetch(url);
        var json = await res.json();
        techDetail = (json.data || json);
    } catch(e) {
        console.warn('[TechDetail] API失败', e);
    }
    
    if (!techDetail) {
        panel.innerHTML = '<div class="detail-content"><div class="tech-detail-header"><span class="tech-detail-name">' + techName + '</span></div>'
            + '<div class="tech-detail-section"><div class="tech-detail-section-title">技术简介</div><div class="tech-detail-text">' + _generateTechIntro(techName) + '</div></div>'
            + '<div class="tech-detail-section"><div class="tech-detail-section-title">应用场景</div><div class="tech-detail-text">' + _generateTechScenario(techName) + '</div></div>'
            + '<button class="graph-btn" style="margin-top:16px;width:100%;justify-content:center;border-color:rgba(212,175,55,.4);color:rgba(184,134,11,.95)" onclick="window.talentRestoreProvincePanel()">← 返回岗位分析</button></div>';
        return;
    }
    
    // 构建详情HTML
    var hotStars = '';
    var hl = techDetail.hotLevel || 3;
    for (var i = 0; i < 5; i++) hotStars += '<span class="tech-detail-hot-star" style="color:' + (i < hl ? '#F59E0B' : 'rgba(0,0,0,.15)') + '">★</span>';
    
    var html = '<div class="detail-content">';
    html += '<button class="graph-btn" style="margin-bottom:12px;font-size:11px;border-color:rgba(212,175,55,.35);color:#8F6B0E" onclick="window.talentRestoreProvincePanel()">← 返回岗位分析</button>';
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
        html += '<span class="tech-detail-tag" style="background:rgba(99,102,241,.1);color:#5b63d3;border-color:rgba(99,102,241,.15)">' + k + '</span>';
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
            html += '<span class="tech-detail-tag" style="cursor:pointer" onclick="window.renderTechDetail(\'' + r + '\',0,0)">' + r + '</span>';
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
            html += '<div class="tech-detail-stat-row"><span class="tech-detail-stat-label">关联城市</span><span class="tech-detail-stat-value">' + st.relatedCities.slice(0,4).join(', ') + '</span></div>';
        }
        if (st.relatedJobs && st.relatedJobs.length) {
            html += '<div class="tech-detail-stat-row"><span class="tech-detail-stat-label">关联岗位</span><span class="tech-detail-stat-value" style="font-size:11px">' + st.relatedJobs.slice(0,5).map(function(j) { return j.name; }).join(', ') + '</span></div>';
        }
        html += '</div>';
    }
    
    html += '</div>';
    panel.innerHTML = html;
};

// AI兜底 - 技术简介
function _generateTechIntro(techName) {
    var map = {
        'Java': 'Java是一种广泛使用的面向对象编程语言，具有跨平台、高性能、安全性强等特点，是企业级应用开发的首选语言之一。',
        'Spring Boot': 'Spring Boot是基于Spring框架的快速应用开发框架，简化了Spring应用的初始搭建和开发过程，提供自动配置和起步依赖。',
        'MySQL': 'MySQL是最流行的开源关系型数据库管理系统，具有高性能、高可靠性、易用性等特点，广泛应用于Web应用开发。',
        'Redis': 'Redis是高性能的key-value内存数据库，支持多种数据结构（字符串、哈希、列表、集合等），常用于缓存、消息队列、实时计数等场景。',
        'Docker': 'Docker是容器化平台，将应用及其依赖打包到轻量级容器中，实现快速部署和环境一致性。',
        'Python': 'Python是简洁优雅的高级编程语言，拥有丰富的第三方库，广泛应用于数据分析、AI、Web开发、自动化等领域。',
        'Vue': 'Vue.js是渐进式JavaScript前端框架，以轻量、易上手、高性能著称，支持组件化开发。',
        'JavaScript': 'JavaScript是Web前端核心编程语言，用于实现网页交互效果和动态功能，全栈开发的重要基础。',
        'Git': 'Git是分布式版本控制系统，用于跟踪代码变化、协同开发和版本管理，是团队协作的基础工具。',
        'Linux': 'Linux是开源操作系统，广泛应用于服务器环境，是运维、开发和云计算的基石。',
        'React': 'React是Facebook开源的JavaScript UI库，采用虚拟DOM和组件化架构，用于构建高性能单页应用。',
        'Node.js': 'Node.js是JavaScript运行时环境，使JavaScript可以运行在服务器端，擅长高并发I/O场景。',
        'TypeScript': 'TypeScript是JavaScript的超集，添加了静态类型系统，提升大型项目的代码质量和可维护性。',
        'Go': 'Go语言由Google开发，具有高性能、简洁语法和内置并发支持，适用于微服务和云原生开发。',
        'C++': 'C++是高性能系统级编程语言，应用于游戏引擎、操作系统、嵌入式系统等对性能要求极高的场景。',
    };
    return map[techName] || techName + '是当前岗位需求中的重要技术技能，在软件开发、系统设计或数据处理等场景中扮演关键角色。掌握' + techName + '有助于提升岗位竞争力。';
}

// AI兜底 - 技术应用场景
function _generateTechScenario(techName) {
    var map = {
        'Java': '企业级后端开发、微服务架构、Android应用、大数据处理（Hadoop/Spark）、金融系统等。',
        'Spring Boot': 'RESTful API开发、微服务架构、企业应用快速搭建、云原生应用部署。',
        'MySQL': 'Web应用数据存储、电商系统、内容管理、日志分析、报表系统等。',
        'Redis': '热点数据缓存、分布式锁、消息队列、实时排行榜、Session共享。',
        'Docker': '微服务容器化、CI/CD流水线、开发环境标准化、多环境一致性部署。',
        'Python': '数据分析与可视化、机器学习与深度学习、自动化脚本、Web后端开发、爬虫。',
        'Vue': '单页应用(SPA)、管理后台、移动端H5、数据可视化大屏、企业级中后台。',
        'JavaScript': '网页交互效果、表单验证、AJAX异步请求、浏览器扩展、全栈Node.js项目。',
    };
    return map[techName] || techName + '在当前岗位及相关技术栈中被广泛使用，是行业通用技术标准的重要组成部分。';
}

// 恢复省份/城市分析面板（取消技术节点选择）
window.talentRestoreProvincePanel = function() {
    techDetailState.currentTech = null;
    var panel = document.getElementById('talent-detail-province');
    if (panel && techDetailState.savedPanelHTML) {
        panel.innerHTML = techDetailState.savedPanelHTML;
        panel.style.display = techDetailState.savedPanelDisplay || 'block';
        techDetailState.savedPanelHTML = '';
        techDetailState.savedPanelDisplay = '';
    } else if (talentMapState.selectedCity) {
        // 无保存内容时兜底：按当前上下文重新渲染（城市 > 省份）
        window.renderProvinceJobList(talentMapState.selectedProvince, talentMapState.selectedCity);
    } else if (talentMapState.selectedProvince) {
        window.renderProvinceDetail(talentMapState.selectedProvince);
    }
};

// 从城市/省份岗位分析页面进入脑图
window.talentMapEnterGraph = function(jobNameOverride) {
    var cityName = null;
    var jobName = jobNameOverride || null;

    // 优先级：selectedCity > selectedProvince（显示用全称，后端已兼容简称/全称）
    if (talentMapState.selectedCity && talentMapState.selectedCity.name) {
        cityName = talentMapState.selectedCity.displayName || talentMapState.selectedCity.name;
    } else if (talentMapState.currentProvinceName) {
        cityName = talentMapState.currentProvinceName;
    } else if (talentMapState.selectedProvince && talentMapState.selectedProvince.name) {
        cityName = talentMapState.selectedProvince.name;
    }

    if (!cityName) {
        window.Utils.showToast('请先选择一个城市或省份', 'amber');
        return;
    }

    // 确定中心岗位名称
    if (!jobName) {
        // 有选中岗位 → 直接用
        if (talentMapState.selectedJob) {
            jobName = talentMapState.selectedJob.name || talentMapState.selectedJob;
        }
        // 有省份岗位列表 → 取第一个（最热门）
        else if (talentMapState.provinceJobs && talentMapState.provinceJobs.length > 0) {
            jobName = talentMapState.provinceJobs[0].name || talentMapState.provinceJobs[0].title;
        }
    }
    if (!jobName) jobName = cityName;

    // 保存当前省份/城市分析面板内容，以便从脑图返回时恢复（不破坏面板 DOM 结构）
    var provPanel = document.getElementById('talent-detail-province');
    if (provPanel && !techDetailState.savedPanelHTML) {
        techDetailState.savedPanelHTML = provPanel.innerHTML;
        techDetailState.savedPanelDisplay = provPanel.style.display || 'block';
    }
    techDetailState.currentTech = null;

    window.talentShowLayer('graph');

    // 同步图谱切换气泡（进入岗位技术图谱后显示三视图切换，默认选中岗位技术图谱）
    talentSyncGraphToggle();

    // 设置右侧面板显示提示
    if (provPanel) {
        provPanel.innerHTML = '<div class="detail-content" style="padding:20px"><div class="detail-empty"><svg viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64"><circle cx="40" cy="40" r="30"/><path d="M40 20v20l14 7"/><circle cx="40" cy="40" r="6" fill="currentColor"/></svg><p style="color:var(--text-dark);font-weight:600;margin:16px 0 4px">' + jobName + ' · 岗位能力图谱</p><p style="color:var(--text-muted);font-size:12px;line-height:1.6">展示' + jobName + '的<br>核心技术需求分布<br><br>点击脑图技术节点<br>查看详细分析</p></div></div>';
        provPanel.style.display = 'block';
    }

    window.renderCityTechGraph(cityName, jobName);
};

// 返回城市/省份岗位列表
window.talentGraphBack = function() {
    window.talentClearTechDetail();
    
    // 恢复上一层页面并重新渲染
    if (talentMapState.mapLevel === 'city' && talentMapState.selectedCity) {
        window.talentShowLayer('province');
        window.renderProvinceJobList(talentMapState.selectedProvince, talentMapState.selectedCity);
        window.talentUpdatePageTitle((talentMapState.selectedCity.displayName || talentMapState.selectedCity.name) + ' · 岗位分析');
    } else if (talentMapState.selectedProvince) {
        window.talentShowLayer('province');
        window.renderProvinceJobList(talentMapState.selectedProvince);
        window.talentUpdatePageTitle(talentMapState.selectedProvince.name);
    }
    document.getElementById('talent-back-btn').style.display = '';
};

// 兼容旧版
window.renderJobGraph = function(job) {
    var cityName = talentMapState.selectedCity ? talentMapState.selectedCity.name :
                   talentMapState.currentProvinceName;
    var jobName = (job && job.name) ? job.name : cityName;
    if (cityName || jobName) {
        window.renderCityTechGraph(cityName, jobName);
    }
};

window.talentGraphSearch = function(term) {
    var inst = talentMapState.jobGraphInstance;
    if (!inst) return;
    if (!term) {
        try {
            inst.getNodes().forEach(function(n) {
                var m = n.getModel();
                m.style.opacity = 1;
            });
            inst.refresh();
        } catch(e) {}
        return;
    }
    try {
        inst.getNodes().forEach(function(n) {
            var m = n.getModel();
            var label = (m.label || '').toLowerCase();
            var matched = label.includes(term.toLowerCase());
            m.style.opacity = matched ? 1 : 0.12;
        });
        inst.refresh();
    } catch(e) {}
};

window.talentGraphFit = function() {
    var inst = talentMapState.jobGraphInstance;
    if (inst && inst.fitView) inst.fitView(20);
};

window.talentGraphFullscreen = function() {
    var el = document.getElementById('talent-map-canvas');
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen();
    else document.exitFullscreen();
    setTimeout(function() {
        if (talentMapState.jobGraphInstance) {
            var c = document.getElementById('talent-graph-container');
            if (c && c.clientWidth > 10) talentMapState.jobGraphInstance.changeSize(c.clientWidth, c.clientHeight);
        }
    }, 200);
};

/* ============================================================
 * 我的能力 —— 用户个人能力采集 + 能力管理 + 个人能力图谱
 * 数据来源：/api/ability/catalog（系统真实技术目录，与岗位技术图谱同源）
 *          /api/ability/{username}（用户能力保存/读取）
 * 关系：User -> UserAbility -> TechAbility（统一技术体系）
 * ============================================================ */
window.talentAbilityState = {
    open: false,        // 弹窗是否打开
    user: null,         // 当前登录用户 {username, role}
    catalog: null,      // 技术目录 {categories:[{name, technologies:[{id,name,frequency}]}]}
    saved: [],          // 已保存能力 [{id,name,category,frequency}]
    filled: false,      // 是否已填写过问卷
    selected: {},       // 问卷已选 {id:true}
    mode: 'loading',    // loading | survey | graph | error | empty
    editing: false,     // 是否编辑模式
    graph: null,        // G6 实例（个人能力图谱）
    categoryMap: {}     // 技术 id -> 分类名
};

function talentAbilityGetUser() {
    try { return JSON.parse(localStorage.getItem('zhitu_user') || 'null'); }
    catch (e) { return null; }
}

window.talentOpenAbility = function() {
    var modal = document.getElementById('ability-modal');
    if (!modal) {
        // 弹窗 DOM 尚未就绪：短暂重试，避免“点击无反应”
        setTimeout(window.talentOpenAbility, 120);
        return;
    }
    var user = talentAbilityGetUser();
    if (!user || !user.username) {
        var msg = '请先登录后再使用「我的能力」';
        if (window.showToast) window.showToast(msg, 'amber');
        else alert(msg);
        setTimeout(function() { window.location.href = '../index.html'; }, 900);
        return;
    }
    var st = window.talentAbilityState;
    st.user = user;
    st.open = true;
    st.selected = {};
    st.editing = false;
    st.saved = [];
    st.filled = false;
    modal.style.display = 'flex';
    var title = document.getElementById('ability-modal-title-text');
    if (title) title.textContent = '我的能力';
    talentAbilityRenderLoading('正在加载技术能力数据…');
    talentAbilityLoad();
};

async function talentAbilityLoad() {
    var st = window.talentAbilityState;
    if (!st.user) return;
    try {
        var catRes = await window.apiFetch('/api/ability/catalog');
        var userRes = await window.apiFetch('/api/ability/' + encodeURIComponent(st.user.username));
        if (!catRes || catRes.code !== 0) throw new Error((catRes && catRes.message) || '技术目录加载失败');
        if (!userRes || userRes.code !== 0) throw new Error((userRes && userRes.message) || '能力数据加载失败');
        st.catalog = catRes.data;
        st.saved = (userRes.data && userRes.data.abilities) || [];
        st.filled = !!(userRes.data && userRes.data.filled);
        st.categoryMap = {};
        (st.catalog.categories || []).forEach(function(cat) {
            (cat.technologies || []).forEach(function(t) { st.categoryMap[t.id] = cat.name; });
        });
        if (st.filled && st.saved.length) {
            talentAbilityRenderGraph();
        } else if (st.filled && !st.saved.length) {
            talentAbilityRenderEmpty();
        } else {
            talentAbilityRenderSurvey(false);
        }
    } catch (e) {
        console.error('[ability] load failed:', e);
        talentAbilityRenderError('能力数据加载失败<br>请稍后重试');
    }
}

function talentAbilityRenderLoading(text) {
    var st = window.talentAbilityState;
    st.mode = 'loading';
    var body = document.getElementById('ability-modal-body');
    if (!body) return;
    body.innerHTML = '<div class="ability-state ability-loading">' +
        '<div class="ability-loading-ring"></div>' +
        '<div class="ability-state-text">' + (text || '加载中…') + '</div></div>';
}

function talentAbilityRenderError(text) {
    var st = window.talentAbilityState;
    st.mode = 'error';
    var body = document.getElementById('ability-modal-body');
    if (!body) return;
    body.innerHTML = '<div class="ability-state ability-error">' +
        '<div class="ability-state-icon">⚠</div>' +
        '<div class="ability-state-title">' + text + '</div>' +
        '<button class="btn btn-primary" onclick="window.talentAbilityRetry()">重试</button></div>';
}

function talentAbilityRenderEmpty() {
    var st = window.talentAbilityState;
    st.mode = 'empty';
    var body = document.getElementById('ability-modal-body');
    if (!body) return;
    var title = document.getElementById('ability-modal-title-text');
    if (title) title.textContent = '我的能力';
    body.innerHTML = '<div class="ability-state ability-empty">' +
        '<div class="ability-empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 2a7 7 0 0 1 4 12.7V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.3A7 7 0 0 1 12 2z"/><path d="M9 21h6M12 9v4"/></svg></div>' +
        '<div class="ability-state-title">还没有建立你的能力图谱</div>' +
        '<div class="ability-state-text">选择你掌握的技术能力<br>开始构建属于你的能力地图</div>' +
        '<button class="btn btn-primary" onclick="window.talentAbilityStartSelect()">开始选择能力</button>' +
        '</div>';
}

window.talentAbilityStartSelect = function() {
    var st = window.talentAbilityState;
    st.selected = {};
    talentAbilityRenderSurvey(false);
};

window.talentAbilityRetry = function() {
    talentAbilityRenderLoading('正在重新加载…');
    talentAbilityLoad();
};

/* ---------------- 能力问卷（多选） ---------------- */
function talentAbilityRenderSurvey(editing) {
    var st = window.talentAbilityState;
    st.mode = 'survey';
    st.editing = !!editing;
    if (!editing) st.selected = {};
    var body = document.getElementById('ability-modal-body');
    if (!body) return;
    var title = document.getElementById('ability-modal-title-text');
    if (title) title.textContent = editing ? '我的能力 · 编辑能力' : '我的能力 · 能力问卷';
    var html = [];
    html.push('<div class="ability-survey">');
    html.push('<div class="ability-survey-head">');
    html.push('<div class="ability-survey-tip">' + (editing ? '编辑你掌握的技术能力' : '请选择你掌握的技术能力') +
        '<div class="ability-survey-sub">点击增加 · 再次点击取消 · 能力数据与系统技术体系一致</div></div>');
    html.push('<div class="ability-survey-count">已选择 <b id="ability-count-num">0</b> 项能力</div>');
    html.push('</div>');
    html.push('<div class="ability-survey-body" id="ability-survey-body">');
    (st.catalog.categories || []).forEach(function(cat) {
        var color = TECH_CATEGORY_COLORS[cat.name] || '#8B8B9E';
        html.push('<div class="ability-cat-block" style="--cat-color:' + color + '">');
        html.push('<div class="ability-cat-title">' + cat.name + '</div>');
        html.push('<div class="ability-cat-techs">');
        (cat.technologies || []).forEach(function(t) {
            html.push('<div class="ability-tech-chip" data-id="' + t.id + '" onclick="window.talentAbilityToggle(' + t.id + ')">' + t.name + '</div>');
        });
        html.push('</div>');
        html.push('</div>');
    });
    html.push('</div>');
    html.push('<div class="ability-survey-foot">');
    html.push('<button class="btn ability-reset-btn" title="清空当前所有选择" onclick="window.talentAbilityAskReset()">重置</button>');
    html.push('<button class="btn" onclick="window.talentAbilityCancelSurvey()">取消</button>');
    html.push('<button class="btn btn-primary ability-confirm-btn" onclick="window.talentAbilitySubmit()">' + (editing ? '确认修改' : '确认生成我的能力图谱') + '</button>');
    html.push('</div>');
    html.push('<div class="ability-reset-confirm" id="ability-reset-confirm">');
    html.push('<div class="ability-reset-confirm-box">');
    html.push('<div class="ability-reset-confirm-title">确定要重置所有已选择的能力吗？</div>');
    html.push('<div class="ability-reset-confirm-text">重置后当前选择将全部清空<br>你可以重新选择能力</div>');
    html.push('<div class="ability-reset-confirm-btns">');
    html.push('<button class="btn" onclick="window.talentAbilityCancelReset()">取消</button>');
    html.push('<button class="btn ability-reset-confirm-ok" onclick="window.talentAbilityDoReset()">确定重置</button>');
    html.push('</div>');
    html.push('</div>');
    html.push('</div>');
    html.push('</div>');
    body.innerHTML = html.join('');
    Object.keys(st.selected).forEach(function(id) { abilityApplyChipSelected(id); });
    talentAbilityUpdateCount();
}

function abilityApplyChipSelected(id) {
    var chips = document.querySelectorAll('.ability-tech-chip[data-id="' + id + '"]');
    for (var i = 0; i < chips.length; i++) {
        chips[i].classList.toggle('selected', !!window.talentAbilityState.selected[id]);
    }
}

function talentAbilityUpdateCount() {
    var n = Object.keys(window.talentAbilityState.selected).length;
    var el = document.getElementById('ability-count-num');
    if (el) el.textContent = n;
}

window.talentAbilityToggle = function(id) {
    var st = window.talentAbilityState;
    if (!id) return;
    if (st.selected[id]) delete st.selected[id];
    else st.selected[id] = true;
    abilityApplyChipSelected(id);
    talentAbilityUpdateCount();
};

/* 重置问卷选择：仅清空当前页面选中状态，不触碰已保存数据与数据库 */
window.talentAbilityAskReset = function() {
    var st = window.talentAbilityState;
    if (Object.keys(st.selected).length === 0) {
        if (window.showToast) window.showToast('当前没有已选择的能力', 'amber');
        return;
    }
    var layer = document.getElementById('ability-reset-confirm');
    if (layer) layer.classList.add('show');
};

window.talentAbilityCancelReset = function() {
    var layer = document.getElementById('ability-reset-confirm');
    if (layer) layer.classList.remove('show');
};

window.talentAbilityDoReset = function() {
    var st = window.talentAbilityState;
    st.selected = {};
    var chips = document.querySelectorAll('.ability-tech-chip.selected');
    for (var i = 0; i < chips.length; i++) chips[i].classList.remove('selected');
    talentAbilityUpdateCount();
    window.talentAbilityCancelReset();
    if (window.showToast) window.showToast('已重置全部选择', 'amber');
};

window.talentAbilitySubmit = async function() {
    var st = window.talentAbilityState;
    var ids = Object.keys(st.selected).map(Number).filter(function(v) { return !isNaN(v) && v > 0; });
    if (!ids.length) {
        window.showToast && window.showToast('请至少选择一项能力', 'amber');
        return;
    }
    var btn = document.querySelector('.ability-confirm-btn');
    if (btn) { btn.disabled = true; btn.textContent = '保存中…'; }
    try {
        var res = await window.apiFetch('/api/ability/' + encodeURIComponent(st.user.username), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ abilityIds: ids })
        });
        if (!res || res.code !== 0) throw new Error((res && res.message) || '保存失败');
        st.saved = (res.data && res.data.abilities) || [];
        st.filled = !!(res.data && res.data.filled);
        window.showToast && window.showToast('能力图谱已更新', '');
        talentAbilityRenderGraph();
    } catch (e) {
        console.error('[ability] save failed:', e);
        window.showToast && window.showToast('能力更新失败，请稍后重试', 'amber');
        if (btn) { btn.disabled = false; btn.textContent = window.talentAbilityState.editing ? '确认修改' : '确认生成我的能力图谱'; }
    }
};

window.talentAbilityCancelSurvey = function() {
    var st = window.talentAbilityState;
    if (st.editing) {
        // 取消编辑：放弃本次修改，恢复进入编辑前的状态
        st.selected = {};
        talentAbilityRenderGraph();
    } else {
        talentAbilityClose();
    }
};

window.talentAbilityEdit = function() {
    var st = window.talentAbilityState;
    st.selected = {};
    (st.saved || []).forEach(function(a) { st.selected[a.id] = true; });
    talentAbilityRenderSurvey(true);
};

/* ---------------- 个人能力图谱（G6，样式复用岗位技术图谱） ---------------- */
function talentAbilityRenderGraph() {
    var st = window.talentAbilityState;
    st.mode = 'graph';
    st.editing = false;
    var body = document.getElementById('ability-modal-body');
    if (!body) return;
    var title = document.getElementById('ability-modal-title-text');
    if (title) title.textContent = '我的能力 · 个人能力图谱';
    var displayName = (st.user && (st.user.name || st.user.username)) || '我';
    var html = [];
    html.push('<div class="ability-graph-page">');
    html.push('<div class="ability-graph-bar">');
    html.push('<div class="ability-graph-title">' + displayName + ' · 能力图谱</div>');
    html.push('<div class="ability-graph-actions">');
    html.push('<button class="graph-btn" title="适应窗口" onclick="window.talentAbilityGraphFit()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></button>');
    html.push('<button class="btn btn-primary" onclick="window.talentAbilityEdit()">编辑能力</button>');
    html.push('</div></div>');
    html.push('<div class="ability-graph-wrap" id="ability-graph-container"></div>');
    html.push('<div class="ability-graph-foot"><div class="ability-graph-summary" id="ability-graph-summary"></div><div class="graph-legend" id="ability-graph-legend"></div></div>');
    html.push('</div>');
    body.innerHTML = html.join('');
    // 等弹窗布局完成后量取容器尺寸
    setTimeout(function() {
        window.ensureG6().then(function() { talentAbilityBuildGraph(); }).catch(function() {
            var c = document.getElementById('ability-graph-container');
            if (c) c.innerHTML = '<div style="padding:24px;color:#fff;text-align:center">图谱库加载失败，请检查网络后重试</div>';
        });
    }, 80);
}

function talentAbilityBuildGraph() {
    var st = window.talentAbilityState;
    var container = document.getElementById('ability-graph-container');
    if (!container) return;
    var w = container.clientWidth, h = container.clientHeight;
    if (w < 60 || h < 60) { setTimeout(talentAbilityBuildGraph, 120); return; }
    if (st.graph) { try { st.graph.destroy(); } catch(e) {} st.graph = null; }

    var saved = st.saved || [];
    if (!saved.length) { talentAbilityRenderEmpty(); return; }

    // 1) 构造分类组（与岗位技术图谱同分类色）
    var groups = [];
    saved.forEach(function(a) {
        var catName = a.category || st.categoryMap[a.id] || '核心技能';
        var g = null;
        for (var i = 0; i < groups.length; i++) {
            if (groups[i].name === catName) { g = groups[i]; break; }
        }
        if (!g) {
            g = { name: catName, catName: catName, catColor: TECH_CATEGORY_COLORS[catName] || '#8B8B9E', id: 'ab-cat-' + groups.length, techs: [] };
            groups.push(g);
        }
        g.techs.push({ name: a.name, id: a.id, frequency: a.frequency });
    });

    // 2) 复用岗位图谱防重叠布局（横向展开 / 盒宽自适应 / 行内并排）
    try { _layoutStackView(groups, w / 2, h / 2, w, h); }
    catch (e) { console.error('[ability] layout:', e); }

    // 3) 构建节点/边（样式与岗位技术图谱 stack 视图一致）
    var nodes = [], edges = [];
    var centerId = 'ab-center';
    nodes.push({ id: 'ab-center-halo', label: '', type: 'decor', x: w / 2, y: h / 2, size: 132, baseSize: 132, style: { fill: 'rgba(255,255,255,0)', stroke: 'rgba(212,175,55,.28)', lineWidth: 1.6, lineDash: [6, 5], shadowColor: 'rgba(212,175,55,.5)', shadowBlur: 18 } });
    var centerStyle = { fill: 'l(0) 0:#D9A92E 1:#F0C75C', stroke: '#A87B1E', lineWidth: 4, shadowColor: 'rgba(212,175,55,.8)', shadowBlur: 32 };
    nodes.push({ id: centerId, label: '我的能力', type: 'center', x: w / 2, y: h / 2, size: 78, baseSize: 78, style: centerStyle, baseStyle: centerStyle, labelCfg: { position: 'center', style: { fill: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-sans),sans-serif', textAlign: 'center', lineHeight: 22 } } });

    groups.forEach(function(g) {
        // 分类背景盒
        if (g.boxW && g.boxH) {
            nodes.push({ id: g.id + '-box', label: '', type: 'rect', boxNode: true, x: g.boxX + g.boxW / 2, y: g.boxY + g.boxH / 2, size: [g.boxW, g.boxH], style: { fill: 'rgba(8,16,28,.42)', stroke: g.catColor, lineWidth: 1.4, radius: 14, shadowColor: 'rgba(212,175,55,.16)', shadowBlur: 14 } });
        }
        // 分类标题条
        var catSize = [g.boxW || 140, g.catTitleH || 38];
        var catStyle = { fill: 'l(0) 0:' + g.catColor + ' 1:rgba(26,24,20,.82)', stroke: 'rgba(255,235,180,.75)', lineWidth: 2.5, radius: 12, shadowColor: 'rgba(212,175,55,.5)', shadowBlur: 14 };
        nodes.push({ id: g.id, label: '◆ ' + g.name, type: 'rect', x: g.calcX, y: g.calcY, size: catSize, baseSize: catSize.slice(), catColor: g.catColor, catName: g.catName, style: catStyle, baseStyle: catStyle, labelCfg: { position: 'center', style: { fill: '#fff', fontSize: 17, fontWeight: 700, fontFamily: 'var(--font-sans),sans-serif', textShadowColor: 'rgba(0,0,0,.4)', textShadowBlur: 3 } } });
        edges.push({ id: 'ab-e-c-' + g.id, source: centerId, target: g.id, type: 'line', style: { stroke: 'rgba(240,199,92,.55)', lineWidth: 2, lineDash: [6, 4], endArrow: false } });
        // 技术卡片
        g.techs.forEach(function(t) {
            var tid = 'ab-t-' + t.id;
            var techSize = [t.cardW || 112, 38];
            var techStyle = { fill: 'l(0) 0:' + g.catColor + ' 1:rgba(20,18,15,.85)', stroke: 'rgba(255,235,180,.6)', lineWidth: 1.6, radius: 11, shadowColor: 'rgba(212,175,55,.3)', shadowBlur: 9 };
            nodes.push({ id: tid, label: t.name, type: 'rect', isTech: true, x: t.calcX, y: t.calcY, size: techSize, baseSize: techSize.slice(), frequency: t.frequency, catColor: g.catColor, catName: g.catName, style: techStyle, baseStyle: techStyle, labelCfg: { position: 'center', style: { fill: '#fff', fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-sans),sans-serif', textShadowColor: 'rgba(0,0,0,.55)', textShadowBlur: 4 } } });
            edges.push({ id: 'ab-e-t-' + t.id, source: g.id, target: tid, type: 'line', style: { stroke: 'rgba(212,175,55,.4)', lineWidth: 1.1, lineDash: [3, 3], endArrow: false } });
        });
    });

    // 4) 创建 G6 图谱（交互/高亮/防白与岗位图谱一致）
    var graph = null;
    try {
        graph = new G6.Graph({
            container: 'ability-graph-container',
            width: w,
            height: h,
            modes: { default: ['drag-canvas', 'zoom-canvas', 'drag-node'] },
            layout: false,
            animate: true,
            animateCfg: { duration: 600 },
            defaultNode: { type: 'circle', labelCfg: { position: 'bottom', offset: 5, style: { fill: '#fff', fontSize: 10, fontWeight: 500, fontFamily: 'var(--font-sans),sans-serif' } } },
            defaultEdge: { type: 'line', style: { stroke: 'rgba(255,214,102,.25)', lineWidth: 1, endArrow: false } },
            nodeStateStyles: {
                active: { fill: 'rgba(16,36,52,.96)', lineWidth: 3, stroke: '#FFD666', shadowColor: 'rgba(255,214,102,.9)', shadowBlur: 24 },
                linked: { lineWidth: 2, stroke: 'rgba(255,214,102,.75)', shadowColor: 'rgba(255,214,102,.4)', shadowBlur: 12 },
                inactive: { opacity: 0.12 }
            },
            edgeStateStyles: { active: { stroke: '#FFD666', lineWidth: 2, opacity: 1, shadowColor: 'rgba(255,214,102,.8)', shadowBlur: 10 }, linked: { stroke: 'rgba(255,214,102,.6)', lineWidth: 1.4, opacity: 0.85 }, inactive: { opacity: 0.06 } }
        });
        graph.data({ nodes: nodes, edges: edges });
        graph.render();
        setTimeout(function() { if (graph && graph.fitView) graph.fitView(28); }, 400);
        st.graph = graph;
    } catch (e) {
        console.error('[ability] graph init:', e);
        talentAbilityRenderError('能力图谱渲染失败<br>请稍后重试');
        return;
    }

    // 5) Hover 联动高亮（active 深色防白 + 关联高亮 + 非关联弱化）
    function highlightGraph(model) {
        if (!graph || !model) return;
        var linkedNodeIds = {}, linkedEdgeIds = {};
        graph.getEdges().forEach(function(edge) {
            var em = edge.getModel();
            if (em.source === model.id || em.target === model.id) {
                linkedEdgeIds[em.id] = true;
                if (em.source !== model.id) linkedNodeIds[em.source] = true;
                if (em.target !== model.id) linkedNodeIds[em.target] = true;
            }
        });
        graph.getNodes().forEach(function(node) {
            var nm = node.getModel();
            if (nm.type === 'decor' || nm.boxNode) return;
            graph.clearItemStates(node, ['active', 'linked', 'inactive']);
            if (nm.id === model.id) {
                if (nm.type !== 'center') graph.setItemState(node, 'active', true);
                if (nm.baseSize) {
                    var bz = nm.baseSize;
                    var hoverStyle = (nm.type === 'center')
                        ? { lineWidth: 4, shadowColor: 'rgba(212,175,55,.9)', shadowBlur: 36 }
                        : { fill: 'rgba(16,36,52,.96)', stroke: '#FFD666', lineWidth: 3, shadowColor: 'rgba(255,214,102,.9)', shadowBlur: 24 };
                    graph.updateItem(node, { size: Array.isArray(bz) ? [bz[0] * 1.18, bz[1] * 1.18] : bz * 1.35, style: hoverStyle });
                }
            } else if (linkedNodeIds[nm.id]) {
                graph.setItemState(node, 'linked', true);
            } else {
                graph.setItemState(node, 'inactive', true);
            }
        });
        graph.getEdges().forEach(function(edge) {
            var em = edge.getModel();
            graph.clearItemStates(edge, ['active', 'linked', 'inactive']);
            if (linkedEdgeIds[em.id]) graph.setItemState(edge, 'active', true);
            else graph.setItemState(edge, 'inactive', true);
        });
    }
    function resetHighlight() {
        if (!graph) return;
        graph.getNodes().forEach(function(node) {
            var nm = node.getModel && node.getModel();
            if (!nm || nm.type === 'decor' || nm.boxNode) return;
            graph.clearItemStates(node, ['active', 'linked', 'inactive']);
            var patch = {};
            if (nm.baseSize) {
                var bz = nm.baseSize;
                var changed = Array.isArray(bz) ? (nm.size && (Math.abs(nm.size[0] - bz[0]) > 0.5 || Math.abs(nm.size[1] - bz[1]) > 0.5)) : Math.abs(nm.size - bz) > 0.5;
                if (changed) patch.size = bz;
            }
            if (nm.baseStyle && nm.style && (nm.style.fill !== nm.baseStyle.fill || nm.style.lineWidth !== nm.baseStyle.lineWidth || (nm.style.stroke || '') !== (nm.baseStyle.stroke || ''))) {
                patch.style = nm.baseStyle;
            }
            if (patch.size || patch.style) graph.updateItem(node, patch);
        });
        graph.getEdges().forEach(function(edge) { graph.clearItemStates(edge, ['active', 'linked', 'inactive']); });
    }

    var tooltipEl = document.createElement('div');
    tooltipEl.className = 'tech-node-tooltip';
    tooltipEl.style.cssText = 'display:none;position:absolute;z-index:1000;background:rgba(10,14,34,.95);color:#fff;padding:9px 15px;border-radius:10px;font-size:12px;pointer-events:none;white-space:nowrap;border:1px solid rgba(212,175,55,.45);box-shadow:0 6px 22px rgba(0,0,0,.5),0 0 16px rgba(212,175,55,.22);backdrop-filter:blur(8px);';
    container.appendChild(tooltipEl);

    graph.on('node:mouseenter', function(evt) {
        var model = evt.item && evt.item.getModel ? evt.item.getModel() : null;
        if (!model || model.type === 'decor' || model.boxNode) { resetHighlight(); return; }
        highlightGraph(model);
        if (model.type === 'center') { tooltipEl.style.display = 'none'; return; }
        tooltipEl.style.display = 'block';
        if (model.isTech) {
            tooltipEl.innerHTML = '<div style="font-size:14px;font-weight:700;color:#FFE9B0;line-height:1.5">' + model.label + '</div>'
                + '<div style="font-size:11px;color:rgba(255,214,102,.72);margin-top:3px">岗位需求频次: ' + (model.frequency || 0) + '</div>';
        } else {
            tooltipEl.innerHTML = '<div style="font-size:13px;font-weight:600;color:#FFE9B0">' + (model.label || model.id) + '</div>';
        }
    });
    graph.on('node:mouseleave', function() { tooltipEl.style.display = 'none'; resetHighlight(); });
    graph.on('node:mousemove', function(evt) { tooltipEl.style.left = (evt.canvasX + 14) + 'px'; tooltipEl.style.top = (evt.canvasY - 24) + 'px'; });

    // 6) 汇总与图例
    var summary = document.getElementById('ability-graph-summary');
    if (summary) summary.textContent = '共 ' + saved.length + ' 项能力 · ' + groups.length + ' 个技术领域';
    var legend = document.getElementById('ability-graph-legend');
    if (legend) {
        legend.innerHTML = groups.map(function(g) {
            return '<div class="legend-item"><span class="legend-dot" style="background:' + g.catColor + '"></span>' + g.name + '</div>';
        }).join('');
    }
}

window.talentAbilityGraphFit = function() {
    var st = window.talentAbilityState;
    if (st.graph && st.graph.fitView) st.graph.fitView(28);
};

window.talentAbilityClose = function() {
    var st = window.talentAbilityState;
    if (st.graph) { try { st.graph.destroy(); } catch(e) {} st.graph = null; }
    st.open = false;
    var modal = document.getElementById('ability-modal');
    if (modal) modal.style.display = 'none';
};
