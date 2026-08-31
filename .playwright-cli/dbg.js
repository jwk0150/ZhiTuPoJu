(() => {
  const out = {};
  const svg = document.getElementById('ir-pano-svg');
  const skills = svg.querySelectorAll('g.ir-pano-skill');
  out.count = skills.length;
  out.all = [...skills].map(g => ({ cat: g.dataset.cat, name: g.dataset.name }));
  // 找到对应 findSkill 是否能命中：模拟 openSkillModal 内部的 getProfile
  // 直接调用页面内函数
  try {
    const pf = window.__getProfile ? window.__getProfile(STATE.jobId) : null;
    out.hasProfileFn = !!pf;
    if (pf) {
      out.pfKeys = Object.keys(pf);
      out.firstCat = skills[0] ? skills[0].dataset.cat : null;
      out.firstName = skills[0] ? skills[0].dataset.name : null;
      const arr = pf[out.firstCat];
      out.arrLen = arr ? arr.length : -1;
      out.arrNames = arr ? arr.map(x => x.name) : null;
      out.match = arr ? arr.find(x => x.name === out.firstName) : 'no-arr';
    }
  } catch (e) { out.err = String(e); }
  return out;
})()