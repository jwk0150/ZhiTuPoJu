var API=(window.API_BASE||'http://127.0.0.1:5000'),UID='demo_user',editMode=false,ivState={msgs:[],active:false};

document.querySelectorAll('.tab').forEach(function(t){t.onclick=function(){
    var id=this.dataset.tab;
    document.querySelectorAll('.tab').forEach(function(x){x.classList.toggle('active',x.dataset.tab===id)});
    document.querySelectorAll('.panel').forEach(function(p){p.classList.toggle('active',p.id==='panel-'+id)});
    if(id==='resume')loadResumes();
    if(id==='analysis')loadReport();
}});

function toast(msg,type){var t=document.getElementById('toast');t.textContent=msg;t.style.opacity='1';t.style.background=type==='error'?'#ef4444':type==='info'?'#3b82f6':'#10b981';setTimeout(function(){t.style.opacity='0'},2500)}

async function loadProfile(){
    try{var r=await fetch(API+'/api/profile/profile/'+UID);var d=await r.json();if(d.code!==0||!d.data)return;
        var p=d.data.profile||{},sk=d.data.skills||[],rp=d.data.report;
        ['name','school','major','education','grade','target-job'].forEach(function(f){var el=document.getElementById('pf-'+f);if(el)el.value=p[f]||''});
        var bio=document.getElementById('pf-bio');if(bio)bio.value=p.bio||'';
        document.getElementById('avatar').textContent=(p.name||'--').slice(0,2);
        document.getElementById('display-name').textContent=p.name||'未填写姓名';
        document.getElementById('display-sub').textContent=(p.major||'')+(p.target_job?' · '+p.target_job:'')||'请完善资料';
        document.getElementById('tag-school').textContent=(p.school||'--');
        document.getElementById('tag-major').textContent=(p.major||'--');
        document.getElementById('tag-target').textContent=p.target_job||'--';
        var fields=['name','school','major','education','grade','target-job'];
        var filled=fields.filter(function(f){return p&&p[f]}).length;
        var pct=Math.min(100,Math.round(filled/fields.length*60+(sk.length>0?20:0)+(rp?20:0)));
        document.getElementById('pct').textContent=pct+'%';document.getElementById('bar').style.width=pct+'%';
        document.getElementById('hint').textContent=pct>=80?'资料完善度优秀':pct>=50?'继续加油，上传简历可大幅提高':'填写基本信息即可解锁';
        document.getElementById('kpi-skills').textContent=sk.length;
        if(rp){var mj=rp.match_jobs;document.getElementById('kpi-matches').textContent=(Array.isArray(mj)?mj.length:'--');document.getElementById('kpi-score').textContent=rp.overall_score||'--'}
        try{var rr=await fetch(API+'/api/profile/resumes/'+UID);var rd=await rr.json();var cnt=(rd.data&&rd.data.resumes?rd.data.resumes.length:0);document.getElementById('kpi-resumes').textContent=cnt}catch(e){}
    }catch(e){console.warn(e)}
}

function toggleEdit(){editMode=!editMode;['name','school','major','education','grade','target-job','bio'].forEach(function(f){var el=document.getElementById('pf-'+f);if(el)el.disabled=!editMode});document.getElementById('edit-btn').style.display=editMode?'none':'';document.getElementById('save-btn').style.display=editMode?'':'none'}
async function saveProfile(){var body={user_id:UID};['name','school','major','education','grade','target-job','bio'].forEach(function(f){var el=document.getElementById('pf-'+f);if(el)body[f]=el.value||null});try{var r=await fetch(API+'/api/profile/profile/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});var d=await r.json();if(d.code===0){editMode=false;loadProfile();toast('保存成功')}else toast('保存失败','error')}catch(e){toast('保存失败','error')}}

async function loadResumes(){try{var r=await fetch(API+'/api/profile/resumes/'+UID);var d=await r.json();var list=(d.data&&d.data.resumes)?d.data.resumes:[];var el=document.getElementById('resume-list');if(!list.length){el.innerHTML='<div class=\"empty-state\"><div class=\"empty-icon\">📂</div><div class=\"empty-title\">暂无简历</div></div>';return}el.innerHTML=list.map(function(r){return'<div class=\"resume-item\"><div class=\"resume-icon\">📄</div><div class=\"resume-info\"><div class=\"resume-name\">'+r.filename+'</div><div class=\"resume-detail\">'+r.status+' · '+(r.text_length||0)+' 字符</div></div><div class=\"resume-actions\"><button class=\"btn btn-sm\" onclick=\"analyzeResume('+r.id+')\">分析</button><button class=\"btn btn-sm btn-danger\" onclick=\"deleteResume('+r.id+')\">删除</button></div></div>'}).join('');document.getElementById('kpi-resumes').textContent=list.length}catch(e){}}
async function uploadResume(file){if(!file)return;var fd=new FormData();fd.append('file',file);fd.append('user_id',UID);try{var r=await fetch(API+'/api/profile/resume/upload',{method:'POST',body:fd});var d=await r.json();if(d.code===0){toast('上传成功');loadResumes()}else toast('上传失败','error')}catch(e){toast('上传失败','error')}}
async function deleteResume(id){if(!confirm('确定删除？'))return;try{await fetch(API+'/api/profile/resume/'+id,{method:'DELETE'});loadResumes();toast('已删除')}catch(e){}}
function renderAIReport(res,resumeId){var edu=res.education||{},skills=res.skills||[],proj=res.projects||[],adv=res.advantages||[],weak=res.weaknesses||[],score=res.overall_score;var h='';

h+='<div class=\"ai-report-header\"><div><div style=\"font-size:14px;font-weight:700\">AI 简历分析</div><div style=\"font-size:10px;color:var(--text-muted);letter-spacing:.04em\">AI RESUME ANALYSIS</div><div style=\"font-size:11px;color:var(--text-secondary);margin-top:4px\">基于你的简历内容，AI 已完成结构化信息提取与分析</div><div class=\"ai-report-status\"><span class=\"ai-report-status-dot\"></span>分析完成</div></div><div class=\"ai-score-box\"><div class=\"ai-score-ring\"><span class=\"ai-score-val\">'+(score||'--')+'</span><span class=\"ai-score-sub\">综合评分</span></div></div></div>';

if(skills.length>0){var top=skills.slice(0,3).map(function(s){return s.name}).join(' / ');h+='<div class=\"ai-section\"><div style=\"padding:14px 16px;background:var(--bg-card);border-radius:var(--radius-md);font-size:12px;color:var(--text-secondary);line-height:1.6\">你的简历主要体现：<b style=\"color:var(--text-primary)\">'+top+'</b><br>共识别 <b style=\"color:var(--accent)\">'+skills.length+'</b> 项技能 · <b style=\"color:var(--accent)\">'+proj.length+'</b> 个项目 · <b style=\"color:var(--accent)\">'+adv.length+'</b> 项优势</div></div>'}

h+='<div class=\"ai-grid-2\"><div class=\"ai-section\"><div class=\"ai-section-title\"><span class=\"ai-section-dot\"></span>基本信息识别</div>';
['school','major','degree','grade'].forEach(function(k){var labels={school:'学校',major:'专业',degree:'学历',grade:'年级'};var v=edu[k]||'';h+='<div class=\"ai-info-row\"><span class=\"ai-info-label\">'+labels[k]+'</span><span class=\"ai-info-val'+(v?'':' muted')+'\">'+(v||'未识别')+'</span></div>'});
h+='</div>';

h+='<div class=\"ai-section\"><div class=\"ai-section-title\"><span class=\"ai-section-dot\"></span>技能能力分析</div>';
skills.forEach(function(s){var sc=s.score||50;h+='<div class=\"ai-skill-item\"><div class=\"ai-skill-head\"><div><span class=\"ai-skill-name\">'+s.name+'</span>'+(s.category?'<span class=\"ai-skill-cat\">'+s.category+'</span>':'')+'</div><span class=\"ai-skill-meta\">'+(s.level||'')+' · <span style=\"font-family:var(--font-mono);color:var(--accent)\">'+sc+'</span></span></div><div class=\"ai-skill-bar\"><div class=\"ai-skill-fill\" style=\"width:'+sc+'%\"></div></div></div>'});
if(!skills.length)h+='<div class=\"ai-empty\">未识别技能</div>';
h+='</div></div>';

if(proj.length>0){h+='<div class=\"ai-section\"><div class=\"ai-section-title\"><span class=\"ai-section-dot\"></span>项目经历分析</div>';proj.forEach(function(p){h+='<div class=\"ai-proj-card\"><div class=\"ai-proj-name\">'+p.name+'</div><div class=\"ai-proj-desc\">'+p.description+'</div><div class=\"ai-proj-techs\">'+(p.skills_used||[]).map(function(t){return'<span class=\"ai-proj-tech\">'+t+'</span>'}).join('')+'</div></div>'});h+='</div>'}

h+='<div class=\"ai-grid-2\">';
h+='<div class=\"ai-section\"><div class=\"ai-section-title\"><span class=\"ai-section-dot\"></span>AI 识别的核心优势</div>';
adv.forEach(function(a,i){h+='<div class=\"ai-str-item\"><span class=\"ai-str-num\">'+(i<9?'0':'')+(i+1)+'</span>'+a+'</div>'});
if(!adv.length)h+='<div class=\"ai-empty\">未识别优势</div>';
h+='</div>';
h+='<div class=\"ai-section\"><div class=\"ai-section-title\"><span class=\"ai-section-dot\"></span>待提升方向</div>';
weak.forEach(function(w,i){h+='<div class=\"ai-weak-item\"><span class=\"ai-weak-num\">'+(i<9?'0':'')+(i+1)+'</span>'+w+'</div>'});
if(!weak.length)h+='<div class=\"ai-empty\">未识别待提升项</div>';
h+='</div></div>';

h+='<div style=\"text-align:center;padding:16px 0 8px;margin-top:12px;border-top:1px solid var(--border-subtle)\"><button class=\"btn btn-primary\" onclick=\"optimizeResumeText('+resumeId+')\">✦ AI 优化简历</button></div><div id=\"optimize-result\"></div>';
return h}

async function analyzeResume(id){toast('AI 分析中...','info');try{var r=await fetch(API+'/api/profile/resume/analyze/'+id,{method:'POST'});var d=await r.json();if(d.code===0){var res=d.data;var card=document.getElementById('analysis-card');var body=document.getElementById('analysis-body');card.style.display='';body.innerHTML=renderAIReport(res,id);loadResumes();loadProfile();toast('分析完成')}else toast('分析失败','error')}catch(e){toast('分析失败','error')}}

async function optimizeResumeText(rid){var el=document.getElementById('optimize-result');el.innerHTML='<div style=\"text-align:center;padding:20px;color:var(--text-muted)\">✦ AI 正在优化简历...</div>';try{var r=await fetch(API+'/api/profile/resume/optimize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resume_id:rid,mode:'professional'})});var d=await r.json();if(d.code===0){var opt=d.data.optimization;var text=opt.summary?opt.summary.optimized:'';if(opt.skills)text+='\n\n技能：\n'+opt.skills.map(function(s){return s.optimized}).join('\n');if(opt.projects)text+='\n\n项目经历：\n'+opt.projects.map(function(p){return p.name+'\n'+p.optimized}).join('\n\n');el.innerHTML='<div class=\"ai-section\" style=\"margin-top:16px\"><div class=\"ai-section-title\"><span class=\"ai-section-dot\"></span>AI 优化结果</div><div class=\"ai-grid-2\"><div style=\"background:rgba(255,255,255,.02);padding:14px;border-radius:var(--radius-md);font-size:12px;line-height:1.7;white-space:pre-wrap;max-height:500px;overflow-y:auto\"><div style=\"font-size:10px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase\">原始简历</div>'+escH(d.data.original_text||'无原始文本')+'</div><div style=\"background:var(--accent-soft);padding:14px;border-radius:var(--radius-md);font-size:12px;line-height:1.7;white-space:pre-wrap;max-height:500px;overflow-y:auto\"><div style=\"font-size:10px;color:var(--accent);margin-bottom:6px;text-transform:uppercase\">AI 优化后</div>'+escH(text)+'</div></div><button class=\"btn btn-sm\" onclick=\"optimizeResumeText('+rid+')\" style=\"margin-top:10px\">重新优化</button></div>'}else el.innerHTML='<div style=\"text-align:center;padding:20px;color:var(--danger)\">AI 优化失败，请稍后重试</div>'}catch(e){el.innerHTML='<div style=\"text-align:center;padding:20px;color:var(--danger)\">AI 优化失败，请稍后重试</div>'}}
function escH(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

function updateStage(qCount){for(var i=1;i<=6;i++){var el=document.getElementById('stg-'+i);el.classList.remove('done','current');if(i<=Math.min(6,Math.floor(qCount/2)+1))el.classList.add(i<=Math.floor(qCount/2)+1?(i===Math.floor(qCount/2)+1?'current':'done'):'')}var pct=Math.min(100,Math.floor(qCount/2)*16+16);var pctEl=document.getElementById('interview-pct');if(pctEl)pctEl.textContent=pct+'%'}
async function startInterview(){ivState={msgs:[],active:true};document.getElementById('chat-box').innerHTML='';document.getElementById('chat-input').disabled=false;document.getElementById('interview-status').textContent='访谈中';updateStage(0);try{var r=await fetch(API+'/api/profile/interview/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:UID})});var d=await r.json();var reply=(d.data&&d.data.reply)?d.data.reply:'你好！请先告诉我你的专业背景吧～';ivState.msgs.push({role:'ai',text:reply});renderChat();updateStage(1)}catch(e){}}
async function sendMsg(){var inp=document.getElementById('chat-input');if(!inp.value.trim())return;var msg=inp.value.trim();inp.value='';ivState.msgs.push({role:'user',text:msg});var hist=ivState.msgs.map(function(m){return{role:m.role==='ai'?'assistant':'user',content:m.text}});try{var r=await fetch(API+'/api/profile/interview/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:UID,history:hist.slice(0,-1),message:msg})});var d=await r.json();if(d.data){ivState.msgs.push({role:'ai',text:d.data.reply||'...'});if(d.data.is_complete){ivState.active=false;document.getElementById('chat-input').disabled=true;document.getElementById('interview-status').textContent='已完成';updateStage(6);toast('访谈完成！正在生成职业分析...');analyzeInterview();setTimeout(function(){loadResumes();loadReport();loadProfile()},1000)}else{updateStage(ivState.msgs.filter(function(m){return m.role==='ai'}).length)}}renderChat()}catch(e){}}
function renderChat(){var el=document.getElementById('chat-box');el.innerHTML=ivState.msgs.map(function(m){return'<div class=\"chat-msg '+(m.role==='ai'?'ai':'user')+'\">'+m.text.replace(/\n/g,'<br>')+'</div>'}).join('');el.scrollTop=el.scrollHeight}

async function analyzeInterview(){var el=document.getElementById('interview-report');el.innerHTML='<div style=\"text-align:center;padding:16px;color:var(--text-muted);margin-top:12px;border-top:1px solid var(--border-subtle)\"><div style=\"font-size:20px;margin-bottom:8px\">✦</div>AI 正在整理你的职业画像...</div>';try{var conv=ivState.msgs.map(function(m){return{role:m.role,text:m.text}});var r=await fetch(API+'/api/profile/interview/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversation:conv})});var d=await r.json();if(d.code===0){renderInterviewReport(d.data)}else{el.innerHTML='<div style=\"text-align:center;padding:16px;color:var(--danger);margin-top:12px;border-top:1px solid var(--border-subtle)\">职业分析暂时无法生成</div>'}}catch(e){el.innerHTML='<div style=\"text-align:center;padding:16px;color:var(--danger);margin-top:12px;border-top:1px solid var(--border-subtle)\">职业分析暂时无法生成，请稍后重试</div>'}}

function renderInterviewReport(data){var h='',ov=data.overview||{},ab=data.core_abilities||[],ci=data.career_interests||[],wp=data.work_preferences||[],st=data.strengths||[],im=data.improvements||[],cd=data.career_directions||[],sum=data.summary||'';
h+='<div style=\"margin-top:16px;padding-top:14px;border-top:1px solid var(--border-subtle)\"><div style=\"display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px\"><div><div style=\"font-size:14px;font-weight:700\">AI 职业访谈分析</div><div style=\"font-size:10px;color:var(--text-muted);letter-spacing:.04em\">AI CAREER INTERVIEW ANALYSIS</div><div style=\"font-size:11px;color:var(--text-secondary);margin-top:4px\">基于本次职业访谈，AI 已完成你的职业信息分析</div></div></div>';

if(ov.stage||ov.direction||ov.goal||ov.summary){h+='<div class=\"ai-section\"><div style=\"padding:12px 14px;background:var(--bg-card);border-radius:var(--radius-md);font-size:12px;color:var(--text-secondary);line-height:1.7\">'+(ov.stage?'<div><b>发展阶段：</b>'+escH(ov.stage)+'</div>':'')+(ov.direction?'<div><b>兴趣方向：</b>'+escH(ov.direction)+'</div>':'')+(ov.goal?'<div><b>职业目标：</b>'+escH(ov.goal)+'</div>':'')+(ov.summary?'<div style=\"margin-top:6px;padding-top:6px;border-top:1px solid var(--border-subtle)\">'+escH(ov.summary)+'</div>':'')+'</div></div>'}

if(ab.length>0){h+='<div class=\"ai-section\"><div class=\"ai-section-title\"><span class=\"ai-section-dot\"></span>核心能力</div>';ab.forEach(function(a){h+='<div style=\"display:flex;justify-content:space-between;padding:8px 12px;background:var(--bg-card);border-radius:var(--radius-sm);margin-bottom:3px;font-size:12px\"><span style=\"font-weight:600\">'+escH(a.name)+'</span><span style=\"color:var(--text-muted);font-size:11px\">'+escH(a.description||'')+'</span></div>'});h+='</div>'}

if(ci.length>0){h+='<div class=\"ai-section\"><div class=\"ai-section-title\"><span class=\"ai-section-dot\"></span>职业兴趣</div><div style=\"display:flex;flex-wrap:wrap;gap:6px\">';ci.forEach(function(i){h+='<span class=\"skill-tag\">'+escH(i.name)+'</span>'});h+='</div></div>'}

if(wp.length>0){h+='<div class=\"ai-section\"><div class=\"ai-section-title\"><span class=\"ai-section-dot\"></span>工作偏好</div>';wp.forEach(function(w){h+='<div style=\"padding:6px 12px;font-size:12px;color:var(--text-secondary)\">· '+escH(w.name)+(w.description?' — <span style=\"color:var(--text-muted);font-size:11px\">'+escH(w.description)+'</span>':'')+'</div>'});h+='</div>'}

h+='<div class=\"ai-grid-2\">';
h+='<div class=\"ai-section\"><div class=\"ai-section-title\"><span class=\"ai-section-dot\"></span>职业优势</div>';
st.forEach(function(s,i){h+='<div class=\"ai-str-item\"><span class=\"ai-str-num\">'+(i<9?'0':'')+(i+1)+'</span><div><b>'+escH(s.title)+'</b>'+(s.detail?'<div style=\"font-size:11px;color:var(--text-muted)\">'+escH(s.detail)+'</div>':'')+'</div></div>'});
if(!st.length)h+='<div class=\"ai-empty\">暂未识别</div>';
h+='</div>';
h+='<div class=\"ai-section\"><div class=\"ai-section-title\"><span class=\"ai-section-dot\"></span>待提升方向</div>';
im.forEach(function(i,n){h+='<div class=\"ai-weak-item\"><span class=\"ai-weak-num\">'+(n<9?'0':'')+(n+1)+'</span><div><b>'+escH(i.title)+'</b>'+(i.suggestion?'<div style=\"font-size:11px;color:var(--text-muted)\">'+escH(i.suggestion)+'</div>':'')+'</div></div>'});
if(!im.length)h+='<div class=\"ai-empty\">暂未识别</div>';
h+='</div></div>';

if(cd.length>0){h+='<div class=\"ai-section\"><div class=\"ai-section-title\"><span class=\"ai-section-dot\"></span>AI 职业方向建议</div>';cd.forEach(function(c,i){h+='<div class=\"ai-proj-card\"><div class=\"ai-proj-name\">TOP '+(i+1)+' · '+escH(c.title)+'</div>'+(c.reason?'<div class=\"ai-proj-desc\">'+escH(c.reason)+'</div>':'')+'</div>'});h+='</div>'}

if(sum){h+='<div class=\"ai-section\"><div class=\"ai-section-title\"><span class=\"ai-section-dot\"></span>AI 职业总结</div><div style=\"padding:12px 14px;background:var(--bg-card);border-radius:var(--radius-md);font-size:12px;color:var(--text-secondary);line-height:1.7\">'+escH(sum)+'</div></div>'}

h+='</div>';
document.getElementById('interview-report').innerHTML=h}


var chartInstances={};
function safeChart(id){var el=document.getElementById(id);if(!el)return null;if(chartInstances[id])chartInstances[id].dispose();if(el.clientWidth<10)el.style.minHeight=el.id==='chart-radar'?'280px':'220px';chartInstances[id]=echarts.init(el);return chartInstances[id]}
async function loadReport(){try{var r=await fetch(API+'/api/profile/career/report/'+UID);var d=await r.json();if(d.data&&d.data.report)renderCharts(d.data)}catch(e){}}
async function runAnalysis(){toast('分析中...','info');try{var r=await fetch(API+'/api/profile/career/analyze/'+UID,{method:'POST'});var d=await r.json();if(d.code===0){renderCharts(d.data);loadProfile();toast('分析完成')}else toast(d.message||'分析失败','error')}catch(e){toast('分析失败','error')}}
function renderCharts(data){var report=data.report||data,skills=data.skills||[],radar=data.radar,matchJobs=data.match_jobs||(report.match_jobs||[]);
var rc=safeChart('chart-radar');if(rc)rc.setOption({radar:{center:['50%','55%'],radius:'65%',indicator:radar?radar.indicators:[{name:'技术能力',max:100},{name:'项目经验',max:100},{name:'数据能力',max:100},{name:'工程能力',max:100},{name:'创新能力',max:100},{name:'学习能力',max:100}],axisName:{color:'#8896a8'},splitArea:{areaStyle:{color:['rgba(45,212,191,.02)','rgba(45,212,191,.04)']}}},series:[{type:'radar',data:radar?radar.series:[{value:[0,0,0,0,0,0]}],areaStyle:{color:'rgba(45,212,191,.15)'},lineStyle:{color:'#2DD4BF',width:2},itemStyle:{color:'#2DD4BF'}}]});
var gc=safeChart('chart-gauge');if(gc)gc.setOption({series:[{type:'gauge',startAngle:210,endAngle:-30,radius:'90%',min:0,max:100,axisLine:{lineStyle:{width:18,color:[[0.3,'#ef4444'],[0.7,'#f59e0b'],[1,'#10b981']]}},pointer:{length:'65%',width:5,itemStyle:{color:'#2DD4BF'}},detail:{valueAnimation:true,formatter:'{value}',fontSize:32,fontWeight:'bold',fontFamily:'JetBrains Mono',offsetCenter:[0,'70%']},data:[{value:report.overall_score||0}]}]});
var cloud=document.getElementById('tag-cloud');if(cloud&&skills.length>0)cloud.innerHTML=skills.map(function(s,i){var cls=i%3===0?'lg':i%3===2?'sm':'';return'<span class=\"skill-tag '+cls+'\">'+(s.skill_name||s.name||'')+'</span>'}).join('');
var jl=document.getElementById('job-list');if(jl&&matchJobs.length>0)jl.innerHTML=matchJobs.slice(0,10).map(function(j,i){return'<div class=\"match-item\"><div class=\"match-rank\">'+(i+1)+'</div><div class=\"match-info\"><div class=\"match-title\">'+j.title+'</div><div class=\"match-company\">'+j.company+'</div></div><div class=\"match-score\"><div class=\"match-pct\">'+j.match_score+'%</div></div></div>'}).join('');
setTimeout(function(){if(rc)rc.resize();if(gc)gc.resize()},500)}

loadProfile();
