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
    if (!item) { title.textContent = 'û���ҵ������Ʒ'; desc.textContent = '���Է�����Ʒ�б��������������ݡ�'; return; }
    title.textContent = item.title;
    document.title = item.title + '��' + (data.site.name || 'Profunfis');
    document.getElementById('projectLabel').textContent = item.label || '��Ʒ';
    desc.textContent = item.desc || '';
    document.getElementById('projectDetail').textContent = item.detail || item.desc || '';
    document.getElementById('projectStory').hidden = false;
    if (item.image) {
      var img = document.getElementById('projectImage'); img.src = item.image; img.alt = item.title + '�ĸ���ʾ��ͼ';
      document.getElementById('projectVisual').hidden = false;
    }
  }).catch(function () { title.textContent = '��ʱ�޷�������Ʒ'; desc.textContent = '��ˢ��ҳ�����ԣ��򷵻���Ʒ�б���'; });
})();
