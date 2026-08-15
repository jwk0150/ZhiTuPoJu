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
    defaultView: { zoom: 1.42, center: [105.5, 36.5] },
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

// 地图基础 regions（label 调整 + 港澳显式样式）
var REGIONS_BASE = [
    { name: '甘肃', label: { position: [104.5, 37.2] } },
    { name: '上海', label: { position: [121.48, 31.23] } },
    { name: '北京', label: { position: [116.40, 39.93] } },
    { name: '天津', label: { position: [117.20, 39.13] } },
    { name: '香港特别行政区', itemStyle: { borderColor: 'rgba(0,212,255,.55)', borderWidth: 2, areaColor: '#0b2036' } },
    { name: '澳门特别行政区', itemStyle: { borderColor: 'rgba(0,212,255,.55)', borderWidth: 2, areaColor: '#0b2036' } }
];

// 系列层港澳高亮样式（覆盖 visualMap 暗色，确保小面积区域可见）
var REGIONS_FOR_SERIES = [
    { name: '香港特别行政区', itemStyle: { areaColor: '#0f3460', borderColor: 'rgba(0,212,255,.7)', borderWidth: 2.5 } },
    { name: '澳门特别行政区', itemStyle: { areaColor: '#0f3460', borderColor: 'rgba(0,212,255,.7)', borderWidth: 2.5 } }
];

// API 基础路径
const API_BASE = (window.API_BASE || 'http://127.0.0.1:5000') + '/api';

// ============== 初始化 ==============
window.initTalentMap = async function() {
    window.bindTalentMapEvents();
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

    // 并行请求：省份数据 + 筛选选项
    var provincesOk = false;
    try {
        const res = await fetch(url);
        const json = await res.json();
        const d = json.data || json;
        talentMapState.allProvinces = d.provinces || [];
        talentMapState.dataLoaded = true;
        // 省份下拉框为全国省级行政区列表，仅初始化一次（不被筛选结果过滤）
        if (d.regions && d.regions.length) window.talentInitProvinceOptions(d.regions);
        window.updateTalentStats();
        console.log('[TalentMap] 加载完成：' + talentMapState.allProvinces.length + ' 个省份');
        provincesOk = true;
    } catch (e) {
        console.warn('[TalentMap] 省份API失败，使用Mock', e);
        window.talentUseMock();
    }

    // 独立请求筛选选项（确保省份下拉框始终有数据）
    try {
        var fRes = await fetch(API_BASE + '/map/filters');
        var fJson = await fRes.json();
        var fd = fJson.data || fJson;
        if (fd.regions && fd.regions.length) window.talentInitProvinceOptions(fd.regions);
    } catch(e) {
        console.warn('[TalentMap] 筛选选项API失败，使用省份名作为省份选项', e);
        // 兜底：从省份名称提取省份选项
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
    // 离开图谱层时清除技能详情状态并恢复右侧面板，防止状态残留
    if (layer !== 'graph') {
        window.talentClearTechDetail();
    }
    if (layer !== 'map' && talentMapState.breathTimer) { clearInterval(talentMapState.breathTimer); talentMapState.breathTimer = null; }
    ['map', 'province', 'graph'].forEach(l => {
        var el = document.getElementById('talent-layer-' + l);
        if (el) el.style.display = l === layer ? '' : 'none';
    });
    // 返回按钮
    var backBtn = document.getElementById('talent-back-btn');
    if (backBtn) backBtn.style.display = (layer === 'map' && talentMapState.selectedProvince) || layer !== 'map' ? '' : 'none';
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
        .map(function(n) { return { name: n, itemStyle: { areaColor: 'rgba(10,22,40,.55)', borderColor: 'rgba(0,212,255,.06)' }, label: { color: 'rgba(255,255,255,.25)' } }; });
    regions.push({
        name: geoName, label: { show: true, fontSize: 13, color: '#00d4ff', fontWeight: 'bold' },
        itemStyle: { borderColor: '#00d4ff', borderWidth: 3, shadowBlur: 28, shadowColor: 'rgba(0,212,255,.6)', areaColor: '#0f3460' }
    });
    chart.setOption({ geo: { regions: regions } });
    // 呼吸动画
    if (talentMapState.breathTimer) clearInterval(talentMapState.breathTimer);
    var breathOn = false;
    talentMapState.breathTimer = setInterval(function() {
        if (!talentMapState.selectedProvince || talentMapState.currentLayer !== 'map') { clearInterval(talentMapState.breathTimer); talentMapState.breathTimer = null; return; }
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
    var curZoom = 1.42, curCx = 105.5, curCy = 36.5;
    try { var opt = chart.getOption(); if (opt.geo && opt.geo[0]) { curZoom = opt.geo[0].zoom || 1.42; curCx = (opt.geo[0].center && opt.geo[0].center[0]) || 105.5; curCy = (opt.geo[0].center && opt.geo[0].center[1]) || 36.5; } } catch(e){}
    var dur = 600, start = null;
    function step(ts) {
        if (!start) start = ts;
        var t = Math.min((ts - start) / dur, 1);
        var e = 1 - Math.pow(1 - t, 3);
        var z = curZoom + (dv.zoom - curZoom) * e;
        var cx = curCx + (dv.center[0] - curCx) * e;
        var cy = curCy + (dv.center[1] - curCy) * e;
        chart.setOption({ geo: { zoom: z, center: [cx, cy], regions: REGIONS_BASE } });
        if (t >= 1) { chart.setOption({ geo: { zoom: dv.zoom, center: dv.center, regions: REGIONS_BASE, itemStyle: { areaColor: '#0d2137', borderColor: 'rgba(0,212,255,.3)' }, label: { color: 'rgba(255,255,255,.65)', fontWeight: 'normal' } } }); }
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

    // 市级地图缩放：稍微缩小，确保所有城市完整显示
    var mapZoom = 0.95;
    var cityCenter = undefined;
    if (provinceName === '北京市' || provinceName === '上海市' || provinceName === '天津市' || provinceName === '重庆市') {
        mapZoom = 1.15;
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
            center: undefined,
            label: { show: true, color: 'rgba(255,255,255,.65)', fontSize: 10, distance: 0 },
            itemStyle: { areaColor: '#0d2137', borderColor: 'rgba(0,212,255,.3)', borderWidth: 1 },
            emphasis: {
                itemStyle: { areaColor: '#0a3a4a', borderColor: '#00d4ff', borderWidth: 2, shadowBlur: 12, shadowColor: 'rgba(0,212,255,.5)' },
                label: { color: '#fff', fontSize: 12 }
            },
            regions: []
        },
        series: [{
            type: 'map', map: geoName, geoIndex: 0,
            data: mapData
        }]
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
            const res = await fetch('../assets/china-geo.json');
            talentMapState.geoJSON = await res.json();
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
            backgroundColor: 'rgba(10,14,39,.95)',
            borderWidth: 0,
            textStyle: { color: '#fff', fontSize: 12 },
            formatter: function(params) {
                const short = toShort(params.name);
                const p = talentMapState.allProvinces.find(x => x.name === short);
                if (!p) return params.name + '<br/>--';
                return '<div style="font-weight:700;color:#00d4ff;margin-bottom:4px">' + p.name + '</div>'
                    + '岗位数量：<b>' + (p.jobCount || 0).toLocaleString() + '</b><br/>'
                    + '热门指数：<b>' + (p.hotIndex || '--') + '</b><br/>'
                    + '增长率：<b style="color:' + ((p.growthRate || 0) >= 0 ? '#4ade80' : '#f87171') + '">'
                    + (p.growthRate >= 0 ? '↑' : '↓') + Math.abs(p.growthRate || 0) + '%</b><br/>'
                    + '点击查看详情';
            }
        },
        visualMap: {
            min: 0,
            max: Math.max(...data.map(d => d.value), 1),
            left: 12,
            bottom: 20,
            text: ['高', '低'],
            textStyle: { color: '#fff', fontSize: 10 },
            inRange: { color: ['#0d2137', '#0f3460', '#1a5276', '#2e86c1', '#00d4ff'] },
            calculable: true
        },
        geo: {
            map: 'china',
            roam: false,
            zoom: 1.42,
            center: [105.5, 36.5],
            layoutCenter: ['50%', '50%'],
            layoutSize: '88%',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            label: {
                show: true,
                fontSize: 9,
                color: 'rgba(255,255,255,.65)',
                fontFamily: 'DM Sans, Noto Sans SC',
                formatter: function(params) {
                    var hidden = ['香港','澳门','香港特别行政区','澳门特别行政区','Hong Kong','Macau'];
                    return hidden.indexOf(params.name) >= 0 ? '' : params.name;
                }
            },
            regions: REGIONS_BASE,
            emphasis: {
                label: {
                    show: true, fontSize: 13, color: '#00d4ff',
                    formatter: function(params) {
                        var hidden = ['香港','澳门','香港特别行政区','澳门特别行政区','Hong Kong','Macau'];
                        return hidden.indexOf(params.name) >= 0 ? '' : params.name;
                    }
                },
                itemStyle: { areaColor: 'rgba(0,212,255,.35)', borderColor: '#00d4ff', borderWidth: 2, shadowBlur: 20, shadowColor: 'rgba(0,212,255,.5)' }
            },
            itemStyle: {
                areaColor: '#0d2137',
                borderColor: 'rgba(0,212,255,.3)',
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
            label: {
                formatter: function(params) {
                    var hidden = ['香港','澳门','香港特别行政区','澳门特别行政区','Hong Kong','Macau'];
                    return hidden.indexOf(params.name) >= 0 ? '' : params.name;
                }
            }
        }]
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
    gEl.style.color = growth >= 0 ? '#4ade80' : '#f87171';
    document.getElementById('talent-hover-salary').textContent = talentFormatSalary(p.avgSalary);
    const badge = document.getElementById('talent-hover-badge');
    badge.textContent = (p.hotIndex >= 80 ? '热门' : p.hotIndex >= 60 ? '活跃' : '增长中');
    badge.style.background = p.hotIndex >= 80 ? 'rgba(244,63,94,.15)' : p.hotIndex >= 60 ? 'rgba(245,158,11,.15)' : 'rgba(13,148,136,.15)';
    badge.style.color = p.hotIndex >= 80 ? '#f43f5e' : p.hotIndex >= 60 ? '#f59e0b' : '#0d9488';
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
            + '<div class="detail-stat"><div class="detail-stat-label">增长率</div><div class="detail-stat-value" style="color:' + ((province.growthRate||0)>=0?'#4ade80':'#f87171') + '">' + ((province.growthRate||0)>=0?'\u2191':'\u2193') + Math.abs(province.growthRate||0) + '%</div></div>'
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
                + '<div class="detail-stat"><div class="detail-stat-label">增长率</div><div class="detail-stat-value" style="color:' + ((province.growthRate||0)>=0?'#4ade80':'#f87171') + '">' + ((province.growthRate||0)>=0?'\u2191':'\u2193') + Math.abs(province.growthRate||0) + '%</div></div>';
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
                lineStyle: { width: 2, color: '#00d4ff' }, itemStyle: { color: '#00d4ff' },
                areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(0,212,255,.35)' }, { offset: 1, color: 'rgba(0,212,255,0)' }] } },
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
        jobsHTML += '<div class="talent-job-card" data-idx="' + i + '" onclick="window.talentSelectJob(' + i + ')">'
            + '<div class="talent-job-card-header"><span class="talent-job-name">' + (j.name || '') + '</span><span class="talent-job-count">' + (j.count || 0).toLocaleString() + ' 个岗位</span></div>'
            + '<div class="talent-job-meta"><span>💰 ' + salaryText + '</span><span style="margin-left:12px;font-size:11px;color:rgba(255,255,255,.4)">热度 ' + (j.hot || 0) + '</span></div>'
            + '<div class="talent-job-skills">' + skillsHtml + '</div>'
            + '<div class="talent-job-card-footer"><span style="font-size:11px;color:rgba(255,255,255,.4)">TOP ' + (i+1) + '</span><button class="talent-job-btn" onclick="event.stopPropagation();window.talentSelectJob(' + i + ');window.talentMapEnterGraph()">进入知识图谱 →</button></div>'
            + '</div>';
    });
    var jobsEl = document.getElementById('talent-province-jobs');
    if (jobsEl) jobsEl.innerHTML = jobsHTML;
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
        card.style.borderColor = i === idx ? '#00d4ff' : 'rgba(255,255,255,.1)';
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
            + '<div class="detail-stat"><div class="detail-stat-label">增长率</div><div class="detail-stat-value" style="color:' + ((province.growthRate||0)>=0?'#4ade80':'#f87171') + '">' + ((province.growthRate||0)>=0?'↑':'↓') + Math.abs(province.growthRate||0) + '%</div></div>'
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


window.renderCityTechGraph = async function(cityName, jobName) {
    var container = document.getElementById('talent-graph-container');
    if (!container) return;
    if (container.clientWidth < 10 || container.clientHeight < 10) {
        setTimeout(function() { window.renderCityTechGraph(cityName, jobName); }, 150);
        return;
    }
    // 销毁旧实例
    if (talentMapState.jobGraphInstance) {
        try { talentMapState.jobGraphInstance.destroy(); } catch(e) {}
        talentMapState.jobGraphInstance = null;
    }
    if (typeof G6 === 'undefined' || !G6.Graph) {
        container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#fff;font-size:14px">G6图谱库加载中，请稍后重试...</div>';
        return;
    }
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,.5);font-size:13px">正在生成' + cityName + '技术知识图谱...</div>';

    document.getElementById('talent-graph-city-label').textContent = cityName;
    techDetailState.currentCity = cityName;
    // 保存用于图谱的岗位名
    techDetailState.graphJobName = jobName || cityName;

    // 调用后端API获取城市技术图谱
    var graphData = null;
    try {
        var apiUrl = API_BASE + '/map/city-tech-graph/' + encodeURIComponent(cityName);
        if (jobName) apiUrl += '?job_title=' + encodeURIComponent(jobName);
        var res = await fetch(apiUrl);
        var json = await res.json();
        graphData = (json.data || json);
    } catch(e) {
        console.warn('[TechGraph] API失败', e);
    }

    if (!graphData || !graphData.categories || !graphData.categories.length) {
        console.warn('[TechGraph] 真实数据不足，使用AI兜底数据');
        graphData = _genTechFallbackGraph(cityName, jobName);
    }

    // 使用API返回的centerJob，或传入的jobName
    var centerJob = graphData.centerJob || jobName || cityName;

    container.innerHTML = '';
    var w = container.clientWidth;
    var h = container.clientHeight;
    var centerX = w / 2;
    var centerY = h / 2;

    // ========== 构建节点和边（中心岗位 + 直接连接所有技术） ==========
    var nodes = [];
    var edges = [];
    var nodeIdCounter = 0;
    var TECH_CATEGORY_COLORS_MAP = TECH_CATEGORY_COLORS || {};

    // 收集所有技术节点（扁平化，去掉类别中间节点）
    var allTechNodes = [];
    graphData.categories.forEach(function(cat) {
        (cat.technologies || []).forEach(function(tech) {
            var catColor = TECH_CATEGORY_COLORS_MAP[cat.name] || '#6366F1';
            allTechNodes.push({
                name: tech.name,
                size: tech.size || 24,
                frequency: tech.frequency || 1,
                ratio: tech.ratio || 0.5,
                catColor: catColor,
                catName: cat.name
            });
        });
    });

    // 如果技术节点过少，追加通用技术
    if (allTechNodes.length < 8) {
        var extraTechs = ['Git', 'Linux', 'Docker', 'MySQL', 'Redis', 'Python', 'Java', 'JavaScript', 'Vue'];
        for (var ei = 0; ei < extraTechs.length && allTechNodes.length < 15; ei++) {
            var alreadyExists = allTechNodes.some(function(t) { return t.name === extraTechs[ei]; });
            if (!alreadyExists) {
                allTechNodes.push({ name: extraTechs[ei], size: 20, frequency: 3, ratio: 0.4, catColor: '#6366F1', catName: '通用技术' });
            }
        }
    }

    // ========== 径向布局算法（类似 Reagraph No-Overlap） ==========
    var maxFreq = 0;
    allTechNodes.forEach(function(t) { if (t.frequency > maxFreq) maxFreq = t.frequency; });

    // 按频率降序排列（大的更靠近中心）
    allTechNodes.sort(function(a, b) { return b.frequency - a.frequency; });

    var totalTechs = allTechNodes.length;
    // 计算环数：12个以内用2环，以上用3环
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

    // 可用半径范围
    var maxRadius = Math.min(w, h) * 0.42;
    var minRadius = Math.min(w, h) * 0.16;

    var ringRadii = [];
    if (rings.length === 1) {
        ringRadii = [maxRadius * 0.55];
    } else if (rings.length === 2) {
        ringRadii = [maxRadius * 0.42, maxRadius * 0.78];
    } else {
        ringRadii = [maxRadius * 0.3, maxRadius * 0.58, maxRadius * 0.82];
    }

    // 预计算位置
    var idx = 0;
    for (var ringIdx = 0; ringIdx < rings.length; ringIdx++) {
        var countInRing = rings[ringIdx];
        if (countInRing <= 0) continue;
        var ringRadius = ringRadii[ringIdx];
        var angleOffset = (ringIdx % 2 === 1) ? Math.PI / countInRing : 0; // 交错环

        for (var i = 0; i < countInRing && idx < totalTechs; i++) {
            var tech = allTechNodes[idx];
            var angle = angleOffset + (2 * Math.PI * i) / countInRing;
            tech.calcX = centerX + ringRadius * Math.cos(angle);
            tech.calcY = centerY + ringRadius * Math.sin(angle);
            idx++;
        }
    }

    // 重叠消除（碰撞检测 + 推力）
    for (var iter = 0; iter < 8; iter++) {
        for (var i = 0; i < totalTechs; i++) {
            for (var j = i + 1; j < totalTechs; j++) {
                var a = allTechNodes[i];
                var b = allTechNodes[j];
                var dx = b.calcX - a.calcX;
                var dy = b.calcY - a.calcY;
                var dist = Math.sqrt(dx * dx + dy * dy);
                var minD = (a.size + b.size) * 0.48;
                if (dist < minD && dist > 0.001) {
                    var force = (minD - dist) / dist * 0.4;
                    var fx = dx * force;
                    var fy = dy * force;
                    a.calcX -= fx;
                    a.calcY -= fy;
                    b.calcX += fx;
                    b.calcY += fy;
                }
            }
        }
        // 将节点拉回各自的环半径附近（只约束径向距离，保持角度）
        for (var i = 0; i < totalTechs; i++) {
            var t = allTechNodes[i];
            var ddx = t.calcX - centerX;
            var ddy = t.calcY - centerY;
            var currR = Math.sqrt(ddx * ddx + ddy * ddy);
            if (currR < 0.01) {
                t.calcX = centerX + 1;
                t.calcY = centerY + 1;
                currR = 1;
            }
            var rdx = ddx / currR;
            var rdy = ddy / currR;
            // 目标半径：在 range 内保持当前角度
            var targetR = Math.max(minRadius, Math.min(maxRadius * 1.05, currR));
            t.calcX = centerX + rdx * (currR * 0.7 + targetR * 0.3);
            t.calcY = centerY + rdy * (currR * 0.7 + targetR * 0.3);
        }
    }

    // 中心节点
    nodes.push({
        id: 'center',
        label: centerJob,
        type: 'center',
        x: centerX,
        y: centerY,
        size: 55,
        style: {
            fill: 'l(0) 0:#0D9488 1:#14B8A6',
            stroke: '#0D9488',
            lineWidth: 4,
            shadowColor: 'rgba(13,148,136,.5)',
            shadowBlur: 20
        },
        labelCfg: {
            position: 'center',
            style: { fill: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans),sans-serif', textAlign: 'center' }
        }
    });

    // 技术节点
    allTechNodes.forEach(function(tech, i) {
        var techId = 'tech-' + i;
        var nodeFill = tech.catColor;
        nodes.push({
            id: techId,
            label: tech.name,
            type: 'technology',
            x: tech.calcX,
            y: tech.calcY,
            size: tech.size,
            frequency: tech.frequency,
            ratio: tech.ratio,
            catColor: tech.catColor,
            style: {
                fill: nodeFill,
                stroke: 'rgba(255,255,255,.45)',
                lineWidth: 2,
                shadowColor: 'rgba(0,0,0,.2)',
                shadowBlur: 6
            },
            labelCfg: {
                position: 'bottom',
                offset: 3,
                style: { fill: '#fff', fontSize: 10, fontWeight: 500, fontFamily: 'var(--font-sans),sans-serif' }
            }
        });
        // 边：中心 → 每个技术节点
        edges.push({
            source: 'center',
            target: techId,
            style: { stroke: 'rgba(255,255,255,.18)', lineWidth: 1, lineDash: [4, 3], endArrow: false }
        });
    });

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
                type: 'line',
                style: { stroke: 'rgba(255,255,255,.15)', lineWidth: 1, lineDash: [5, 4], endArrow: false }
            }
        });

        talentMapState.jobGraphInstance.data({ nodes: nodes, edges: edges });
        talentMapState.jobGraphInstance.render();

        // fitView 确保所有节点可见
        setTimeout(function() {
            if (talentMapState.jobGraphInstance && talentMapState.jobGraphInstance.fitView) {
                talentMapState.jobGraphInstance.fitView(35);
            }
        }, 500);

        // 技术节点点击 → 右侧技术详情
        talentMapState.jobGraphInstance.on('node:click', function(evt) {
            var model = evt.item && evt.item.getModel ? evt.item.getModel() : null;
            if (!model || model.type !== 'technology') return;
            window.renderTechDetail(model.label || model.id, model.frequency, model.ratio);
        });

        // 鼠标悬浮tooltip
        var tooltipEl = document.createElement('div');
        tooltipEl.className = 'tech-node-tooltip';
        tooltipEl.style.cssText = 'display:none;position:absolute;z-index:1000;background:rgba(0,0,0,.85);color:#fff;padding:6px 12px;border-radius:6px;font-size:12px;pointer-events:none;white-space:nowrap;border:1px solid rgba(45,212,191,.3);backdrop-filter:blur(8px);';
        container.appendChild(tooltipEl);

        talentMapState.jobGraphInstance.on('node:mouseenter', function(evt) {
            var model = evt.item && evt.item.getModel ? evt.item.getModel() : null;
            if (!model || model.type === 'center') { tooltipEl.style.display = 'none'; return; }
            tooltipEl.style.display = 'block';
            if (model.type === 'technology') {
                tooltipEl.innerHTML = '<b>' + model.label + '</b><br><span style="font-size:10px;color:rgba(255,255,255,.55)">需求频率: ' + (model.frequency || 0) + ' | 点击查看详情</span>';
            } else {
                tooltipEl.innerHTML = '<b>' + (model.label || model.id) + '</b>';
            }
        });
        talentMapState.jobGraphInstance.on('node:mouseleave', function() {
            tooltipEl.style.display = 'none';
        });
        talentMapState.jobGraphInstance.on('node:mousemove', function(evt) {
            tooltipEl.style.left = (evt.canvasX + 14) + 'px';
            tooltipEl.style.top = (evt.canvasY - 24) + 'px';
        });

        // 触摸设备支持
        talentMapState.jobGraphInstance.on('node:touchstart', function(evt) {
            var model = evt.item && evt.item.getModel ? evt.item.getModel() : null;
            if (!model || model.type !== 'technology') return;
            window.renderTechDetail(model.label || model.id, model.frequency, model.ratio);
        });

    } catch(e) {
        console.warn('[TechGraph] G6渲染失败', e);
        container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,.35);font-size:13px">图谱渲染失败，请重试</div>';
    }
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
            + '<button class="graph-btn" style="margin-top:16px;width:100%;justify-content:center;border-color:rgba(45,212,191,.3);color:rgba(45,212,191,.9)" onclick="window.talentRestoreProvincePanel()">← 返回岗位分析</button></div>';
        return;
    }
    
    // 构建详情HTML
    var hotStars = '';
    var hl = techDetail.hotLevel || 3;
    for (var i = 0; i < 5; i++) hotStars += '<span class="tech-detail-hot-star" style="color:' + (i < hl ? '#F59E0B' : 'rgba(0,0,0,.15)') + '">★</span>';
    
    var html = '<div class="detail-content">';
    html += '<button class="graph-btn" style="margin-bottom:12px;font-size:11px;border-color:rgba(13,148,136,.3);color:#0d9488" onclick="window.talentRestoreProvincePanel()">← 返回岗位分析</button>';
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

    // 设置右侧面板显示提示
    if (provPanel) {
        provPanel.innerHTML = '<div class="detail-content" style="padding:20px"><div class="detail-empty"><svg viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64"><circle cx="40" cy="40" r="30"/><path d="M40 20v20l14 7"/><circle cx="40" cy="40" r="6" fill="currentColor"/></svg><p style="color:var(--text-dark);font-weight:600;margin:16px 0 4px">' + jobName + ' · 岗位能力图谱</p><p style="color:var(--text-muted);font-size:12px;line-height:1.6">展示' + cityName + ' · ' + jobName + '的<br>核心技术需求分布<br><br>点击脑图技术节点<br>查看详细分析</p></div></div>';
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
    // 旧版入口：如果传入了job，取city名进入新版脑图
    var cityName = talentMapState.selectedCity ? talentMapState.selectedCity.name :
                   talentMapState.currentProvinceName;
    if (job && job.name) {
        // 尝试从job名称推断城市
    }
    if (cityName) {
        window.renderCityTechGraph(cityName);
    } else if (job && job.name) {
        window.renderCityTechGraph(job.name);
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
