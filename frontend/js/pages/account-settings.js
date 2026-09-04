(function () {
  'use strict';
  function read(key, fallback) { try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function userId() { var u = read('zhitu_user', null); return u && (u.username || u.user_id || u.id) ? String(u.username || u.user_id || u.id) : 'guest'; }
  function profileKey() { return 'zhitu_my_profile_v1__' + userId(); }
  function gate(person) {
    var checks = [
      ['name', '姓名', !!String(person.name || '').trim()],
      ['phone', '手机号', /^1[3-9]\d{9}$/.test(String(person.phone || '').replace(/\D/g, ''))],
      ['email', '邮箱', /^\S+@\S+\.\S+$/.test(String(person.email || '').trim())],
      ['city', '所在城市', !!String(person.city || '').trim()]
    ];
    return { complete: checks.every(function (x) { return x[2]; }), missing: checks.filter(function (x) { return !x[2]; }) };
  }
  function toast(message, error) { var node = document.getElementById('account-toast'); node.textContent = message; node.style.color = error ? '#B64034' : '#347868'; }
  function cityOptions() { return ['北京','上海','广州','深圳','杭州','成都','南京','武汉','西安','重庆','苏州','天津','厦门','青岛','长沙','郑州','其他']; }
  function fillCitySelect(select, value) {
    if (!select) return;
    select.innerHTML = '<option value="">请选择城市</option>' + cityOptions().map(function (city) {
      return '<option value="' + city.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '">' + city + '</option>';
    }).join('');
    if (cityOptions().indexOf(value) >= 0) select.value = value;
  }
  function init() {
    var user = read('zhitu_user', null) || {};
    var profile = read(profileKey(), {}) || {};
    var person = Object.assign({}, profile.userProfile || {});
    var label = user.name || user.displayName || user.nickname || user.username || '访客';
    document.getElementById('account-identity').textContent = '当前账户 · ' + label + (user.username && user.username !== label ? '（' + user.username + '）' : '');
    document.getElementById('account-name').value = person.name || user.name || user.displayName || user.nickname || '';
    document.getElementById('account-phone').value = person.phone || '';
    fillCitySelect(document.getElementById('account-city'), person.city || '');
    document.getElementById('account-email').value = person.email || user.email || '';
    document.getElementById('account-notify').checked = read('zhitu_account_preferences__' + userId(), {}).notify === true;

    var params = new URLSearchParams(location.search);
    var returnTarget = params.get('return');
    var returning = returnTarget === 'resume' || returnTarget === 'profile';
    var returnBox = document.getElementById('account-return');
    var returnCopy = document.getElementById('account-return-copy');
    var backHref = returnTarget === 'profile' ? 'my-profile.html?v=fix25c5' : 'news/index.html';
    var backLink = document.querySelector('.account-back');
    var cancelLink = document.querySelector('.account-secondary');
    if (backLink) backLink.href = backHref;
    if (cancelLink) cancelLink.href = backHref;
    if (returnTarget === 'profile') {
      document.querySelector('.account-return strong').textContent = '完善资料后，回到我的资料';
    }
    if (returning) {
      returnBox.hidden = false;
      returnCopy.textContent = returnTarget === 'profile'
        ? '补齐基础信息后，你可以继续完善教育经历与求职方向。'
        : '还缺少：' + (params.get('missing') || '基础资料') + '。保存后即可继续进入简历探索。';
      document.getElementById('account-missing').textContent = '';
    }
    function continueResume() {
      var result = gate(person);
      if (!result.complete) { toast('还有未完成的基础资料，请继续填写', true); var first = result.missing[0]; var input = document.getElementById('account-' + first[0]); if (input) input.focus(); return; }
      try { sessionStorage.setItem('zhitu_open_resume', '1'); } catch (_) {}
      location.href = 'resume.html?embed=1&v=20260826rx4';
    }
    function continueProfile() {
      if (!gate(person).complete) { toast('还有未完成的基础资料，请继续填写', true); return; }
      location.href = 'my-profile.html?v=fix25c5';
    }
    document.getElementById('account-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var values = {
        name: document.getElementById('account-name').value.trim(),
        phone: document.getElementById('account-phone').value.trim(),
        city: document.getElementById('account-city').value.trim(),
        email: document.getElementById('account-email').value.trim()
      };
      var next = gate(values);
      if (!next.complete) {
        var first = next.missing[0];
        toast('请补充：' + next.missing.map(function (x) { return x[1]; }).join('、'), true);
        var input = document.getElementById('account-' + first[0]); if (input) input.focus();
        return;
      }
      profile.userProfile = Object.assign({}, person, values);
      try {
        localStorage.setItem(profileKey(), JSON.stringify(profile));
        localStorage.setItem('zhitu_account_preferences__' + userId(), JSON.stringify({ notify: document.getElementById('account-notify').checked }));
        window.dispatchEvent(new CustomEvent('zhitu-profile-changed', { detail: { data: profile } }));
        person = Object.assign({}, values);
        toast('基础资料已保存');
        if (returning) {
          document.getElementById('account-continue').hidden = false;
          document.getElementById('account-resume').textContent = returnTarget === 'profile' ? '返回我的资料 →' : '继续简历探索 →';
        }
      } catch (_) { toast('保存失败，请检查浏览器存储空间', true); }
    });
    document.getElementById('account-resume').addEventListener('click', returnTarget === 'profile' ? continueProfile : continueResume);
    document.getElementById('account-clear').addEventListener('click', function () {
      if (!window.confirm('确认清理当前账户的本地简历和资料吗？此操作不可撤销。')) return;
      ['zhitu_my_profile_v1__' + userId(), 'rb_builder_state_v2__' + userId(), 'rb_builder_state_v1__' + userId(), 'zhitu_match_resume_v1__' + userId(), 'zhitu_vault_resumes_v1__' + userId(), 'rb_resume_library_v1__' + userId(), 'zhitu_account_preferences__' + userId()].forEach(function (key) { try { localStorage.removeItem(key); } catch (_) {} });
      toast('本地数据已清理');
    });
    document.getElementById('account-logout').addEventListener('click', function () { try { localStorage.removeItem('zhitu_user'); } catch (_) {} location.href = '../index.html'; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
