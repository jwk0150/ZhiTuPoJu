// ============== Settings View ==============
window.settingsTabNames = { llm:'大模型配置', graph:'图谱配置', crawl:'采集配置', user:'用户权限', sys:'系统监控' };
window.switchSettingsTab = function(tabId) {
    const view = document.getElementById('view-settings');
    if (!view || !tabId) return;
    view.querySelectorAll('.setting-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.st === tabId);
    });
    view.querySelectorAll('.setting-pane').forEach(p => {
        p.classList.toggle('active', p.dataset.pane === tabId);
    });
    const content = document.querySelector('.content');
    if (content) content.scrollTop = 0;
    window.Utils.showToast('已切换: ' + (window.settingsTabNames[tabId] || tabId), 'cyan');
};
window.initSettings = function() {
    const view = document.getElementById('view-settings');
    if (!view) return;
    if (!view.dataset.bound) {
        view.dataset.bound = '1';
        view.querySelectorAll('.setting-tab').forEach(t => {
            t.addEventListener('click', () => window.switchSettingsTab(t.dataset.st));
        });
        view.querySelectorAll('.switch').forEach(s => {
            s.addEventListener('click', () => {
                s.classList.toggle('on');
                const label = s.parentElement.querySelector('.setting-label')?.textContent || '设置';
                window.Utils.showToast(label + ': ' + (s.classList.contains('on') ? '已开启' : '已关闭'), s.classList.contains('on') ? 'mint' : 'pink');
            });
        });
        const saveBtn = document.getElementById('settings-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const original = saveBtn.innerHTML;
                saveBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> 已保存';
                saveBtn.style.background = 'var(--gradient-success)';
                window.Utils.showToast('✓ 当前分类配置已保存', 'mint');
                setTimeout(() => { saveBtn.innerHTML = original; saveBtn.style.background = ''; }, 2000);
            });
        }
    }
    // 每次进入设置页，确保有一个激活面板
    const active = view.querySelector('.setting-tab.active')?.dataset.st || 'llm';
    view.querySelectorAll('.setting-pane').forEach(p => {
        p.classList.toggle('active', p.dataset.pane === active);
    });
    window.LiveUpdater.start('sys-status', () => {
        if (window.currentViewId !== 'settings') return;
        const stats = view.querySelectorAll('#sys-stats .detail-stat-value');
        if (stats.length >= 4) {
            stats[0].textContent = window.Utils.rand(35,65) + '%';
            stats[1].textContent = window.Utils.rand(60,75) + '%';
            stats[2].textContent = window.Utils.rand(50,60) + '%';
            stats[3].textContent = window.Utils.rand(65,80) + '%';
        }
    }, 4000);
};


// ============== 合并补充：数字人才地图 JS（李帅） ==============

