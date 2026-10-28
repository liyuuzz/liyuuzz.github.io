(function () {
  'use strict';
  var title = document.getElementById('projectTitle');
  var desc = document.getElementById('projectDesc');
  fetch('content.json', { cache: 'no-cache' }).then(function (response) {
    if (!response.ok) throw new Error('content unavailable');
    return response.json();
  }).then(function (data) {
    var raw = new URLSearchParams(location.search).get('w');
    var index = raw === null ? 1 : Number(raw);
    var items = data.works && data.works.items || [];
    var item = Number.isInteger(index) && index > 0 && items[index - 1];
    if (!item) { title.textContent = '没有找到这件作品'; desc.textContent = '可以返回作品列表，看看其他内容。'; return; }
    title.textContent = item.title;
    document.title = item.title + '｜' + (data.site.name || 'Profunfis');
    document.getElementById('projectLabel').textContent = item.label || '作品';
    desc.textContent = item.desc || '';
    document.getElementById('projectDetail').textContent = item.detail || item.desc || '';
    document.getElementById('projectStory').hidden = false;
    if (item.image) {
      var img = document.getElementById('projectImage'); img.src = item.image; img.alt = item.title + '的概念示意图';
      document.getElementById('projectVisual').hidden = false;
    }
  }).catch(function () { title.textContent = '暂时无法加载作品'; desc.textContent = '请刷新页面重试，或返回作品列表。'; });
})();
