(function () {
  'use strict';
  const M = window.StudioDeskModel;
  const KEY = 'studio-yebisu-desk-v1';
  const $ = id => document.getElementById(id);
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const dateFormat = new Intl.DateTimeFormat('ja-JP', { month: 'short', day: 'numeric', timeZone: 'Asia/Tokyo' });
  const fullDateFormat = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo' });
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
  const formatDate = (date, full = false) => date ? (full ? fullDateFormat : dateFormat).format(new Date(date + 'T12:00:00+09:00')) : '未設定';
  const id = () => window.crypto && crypto.randomUUID ? crypto.randomUUID() : `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const dialogs = ['project-dialog', 'task-dialog', 'confirm-dialog', 'help-dialog'];
  const openers = new Map();
  let projects;
  let selected = null;
  let filters = { query: '', status: 'all', category: 'all' };
  let editingProject = null;
  let editingTask = null;
  let taskProject = null;
  let formSnapshot = '';
  let confirmAction = null;
  let toastTimer;
  let persistenceBlocked = false;

  function storageWarning(message) {
    $('storage-warning').textContent = message;
    $('storage-warning').hidden = !message;
    if (message) $('save-state').textContent = 'この画面だけで保持';
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw === null) { projects = M.demoProjects(today); return; }
      const value = JSON.parse(raw);
      if (!M.isPersistedState(value)) throw new Error('Unsupported saved state');
      projects = value.projects;
      $('save-state').textContent = '保存内容を読み込みました';
    } catch (_error) {
      projects = M.demoProjects(today);
      persistenceBlocked = true;
      storageWarning('保存データを読み込めませんでした。デモを表示しています。保存を再開するには「デモを初期状態に戻す」を使ってください。');
    }
  }
  function persist() {
    if (persistenceBlocked) return false;
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, projects }));
      storageWarning('');
      $('save-state').textContent = new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' }).format(new Date()) + ' 保存済み';
      return true;
    } catch (_error) {
      storageWarning('このブラウザに保存できません。変更はこの画面だけに残り、ページを閉じると失われます。ブラウザの保存設定・空き容量を確認してください。');
      return false;
    }
  }
  function notify(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    toastTimer = setTimeout(() => { $('toast').textContent = ''; }, 6500);
  }
  function saveAndNotify(message) {
    const saved = persist();
    notify(message + (saved ? '' : ' この画面のみの変更です。'));
  }
  function readRoute() {
    const params = new URLSearchParams(location.hash.slice(1));
    filters.query = params.get('q') || '';
    filters.status = Object.hasOwn(M.statuses, params.get('status')) ? params.get('status') : 'all';
    filters.category = Object.hasOwn(M.categories, params.get('category')) ? params.get('category') : 'all';
    selected = params.get('project');
    $('project-search').value = filters.query;
    $('category-filter').value = filters.category;
  }
  function writeRoute() {
    const params = new URLSearchParams();
    if (filters.query) params.set('q', filters.query);
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.category !== 'all') params.set('category', filters.category);
    if (selected) params.set('project', selected);
    try { history.replaceState(null, '', location.pathname + location.search + (params.size ? '#' + params : '')); } catch (_error) { /* file previews may restrict history */ }
  }
  const selectedProject = () => projects.find(project => project.id === selected);
  const options = (map, value) => Object.entries(map).map(([key, label]) => `<option value="${key}"${key === value ? ' selected' : ''}>${label}</option>`).join('');
  const icons = { guide: '▤', app: '▦', game: '◇', other: '□' };

  function renderNext() {
    const next = M.nextTasks(projects);
    $('next-tasks').innerHTML = next.length ? next.map(({ project, task }) => `<li class="next-item"><button type="button" class="next-card" data-select="${escape(project.id)}" aria-label="${escape(project.title)}の詳細を開く。次のタスク：${escape(task.title)}"><span class="next-project">${escape(project.title)}</span><strong>${escape(task.title)}</strong><span class="next-meta"><span>${M.statuses[project.status]}</span><span>優先度 ${M.priorities[project.priority]}</span>${project.dueDate ? `<span>${formatDate(project.dueDate)} 目安</span>` : ''}</span><span class="open-cue" aria-hidden="true">↗</span></button></li>`).join('') : '<li class="next-empty">次のタスクはありません。進めたい制作にタスクを追加するか、新しいプロジェクトをつくってみましょう。</li>';
  }
  function renderList(visible) {
    $('projects-title').textContent = filters.status === 'all' ? 'すべての制作' : M.statuses[filters.status] + 'の制作';
    $('result-count').textContent = `${new Intl.NumberFormat('ja-JP').format(visible.length)} / ${new Intl.NumberFormat('ja-JP').format(projects.length)} 件`;
    $('filter-summary').hidden = !filters.query && filters.status === 'all' && filters.category === 'all';
    $('filter-description').textContent = '検索・絞り込みを適用中';
    $('project-list').innerHTML = visible.map(project => {
      const progress = M.progress(project);
      const overdue = project.dueDate && project.dueDate < today && project.status !== 'done';
      return `<li><button type="button" class="project-row" data-select="${escape(project.id)}" id="select-${escape(project.id)}" aria-pressed="${project.id === selected}" aria-label="${escape(project.title)}、${M.statuses[project.status]}、タスク${progress.total}件中${progress.done}件完了。詳細を開く"><span class="row-title-line"><span class="project-icon ${project.category}" aria-hidden="true">${icons[project.category]}</span><span class="row-name"><strong>${escape(project.title)}</strong><span class="row-category">${M.categories[project.category]}</span></span><span class="status status-${project.status}">${M.statuses[project.status]}</span></span><span class="row-bottom"><span class="row-progress"><span class="progress-label"><span>タスク ${progress.done} / ${progress.total}</span><span>${progress.percent}%</span></span><span class="progress-track" aria-hidden="true"><span style="width:${progress.percent}%"></span></span></span><span class="row-priority ${project.priority}">優先度 ${M.priorities[project.priority]}</span><span class="row-date${overdue ? ' overdue' : ''}">${project.dueDate ? formatDate(project.dueDate) : '日付未設定'}${overdue ? '<br>目安を過ぎています' : ''}</span></span></button></li>`;
    }).join('');
    $('empty-projects').hidden = visible.length > 0;
    document.querySelectorAll('[data-status]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.status === filters.status)));
    document.querySelectorAll('[data-count]').forEach(label => { label.textContent = label.dataset.count === 'all' ? projects.length : projects.filter(project => project.status === label.dataset.count).length; });
  }
  function renderDetail() {
    const project = selectedProject();
    if (!project) {
      $('project-detail').innerHTML = '<div class="detail-empty"><strong>制作を選ぶと、ここに詳細が開きます</strong><p>一覧から選ぶか、絞り込みを解除してください。</p></div>';
      return;
    }
    const progress = M.progress(project);
    const overdue = project.dueDate && project.dueDate < today && project.status !== 'done';
    $('project-detail').innerHTML = `<div class="detail-top"><div class="detail-meta"><span>${M.categories[project.category]}</span><button type="button" class="edit-project" id="edit-project">編集する</button></div><h2 id="detail-title" tabindex="-1">${escape(project.title)}</h2><p class="detail-description">${project.description ? escape(project.description) : '説明はまだありません。「編集する」から、この制作の目的を書いておけます。'}</p><div class="detail-controls"><div><label for="detail-status">状態</label><select id="detail-status" name="status">${options(M.statuses, project.status)}</select></div><div><label for="detail-priority">優先度</label><select id="detail-priority" name="priority">${options(M.priorities, project.priority)}</select></div></div><p class="detail-date"><span>目安の日</span>${project.dueDate ? `<time datetime="${project.dueDate}"${overdue ? ' class="overdue"' : ''}>${formatDate(project.dueDate, true)}${overdue ? '（目安を過ぎています）' : ''}</time>` : '<span>未設定</span>'}</p></div><section class="task-section" aria-labelledby="task-list-title"><div class="task-heading"><h3 id="task-list-title">タスク</h3><span>${progress.done} / ${progress.total} 完了</span></div>${project.tasks.length ? `<ul class="task-list">${project.tasks.map(task => `<li class="task-row"><label for="check-${escape(task.id)}"><input type="checkbox" id="check-${escape(task.id)}" data-task-check="${escape(task.id)}"${task.done ? ' checked' : ''}><span>${escape(task.title)}</span></label><button type="button" class="task-edit" id="edit-${escape(task.id)}" data-task-edit="${escape(task.id)}" aria-label="${escape(task.title)}を編集">編集</button></li>`).join('')}</ul>` : '<p class="task-empty">最初の一歩を書いてみましょう。小さく区切ると、着手しやすくなります。</p>'}<button class="add-task" type="button" id="add-task"><span aria-hidden="true">＋</span>タスクを追加</button></section>`;
  }
  function render(focusId = null) {
    const visible = M.filterProjects(projects, filters);
    if (!visible.some(project => project.id === selected)) selected = visible[0] ? visible[0].id : null;
    renderNext(); renderList(visible); renderDetail(); writeRoute();
    if (focusId) $(focusId)?.focus({ preventScroll: true });
  }
  function clearFilters() {
    filters = { query: '', status: 'all', category: 'all' };
    $('project-search').value = '';
    $('category-filter').value = 'all';
  }
  function ensureVisible(project) {
    if (M.filterProjects([project], filters).length) return '';
    clearFilters();
    return ' 絞り込みを解除して表示しています。';
  }
  function selectProject(projectId) {
    const project = projects.find(item => item.id === projectId);
    if (!project) return;
    const reset = ensureVisible(project);
    selected = project.id;
    render();
    $('detail-title')?.focus({ preventScroll: true });
    if (matchMedia('(max-width:970px)').matches) $('project-detail').scrollIntoView({ behavior: 'instant', block: 'start' });
    if (reset) notify('制作の詳細を開きました。' + reset);
  }
  function snapshot(form) { return JSON.stringify([...new FormData(form).entries()]); }
  function activeEditor() { return $('project-dialog').open ? 'project' : $('task-dialog').open ? 'task' : null; }
  function isDirty() { const kind = activeEditor(); return kind ? snapshot($(kind + '-form')) !== formSnapshot : false; }
  function openDialog(name) {
    openers.set(name, document.activeElement);
    $(name).showModal();
    if (name === 'project-dialog' || name === 'task-dialog') {
      const kind = name.replace('-dialog', '');
      formSnapshot = snapshot($(kind + '-form'));
      if (matchMedia('(pointer:fine)').matches) $(kind + '-title').focus();
      else $(kind + '-dialog-title').focus();
    } else if (name === 'confirm-dialog') $('confirm-cancel').focus();
    else $('help-title').focus();
  }
  function closeDialog(name, restore = true) {
    $(name).close();
    if (restore) {
      const opener = openers.get(name);
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
      else $('add-project').focus({ preventScroll: true });
    }
  }
  function askConfirm(title, description, accept, action) {
    $('confirm-title').textContent = title;
    $('confirm-description').textContent = description;
    $('confirm-accept').textContent = accept;
    confirmAction = action;
    openDialog('confirm-dialog');
  }
  function requestClose(name) {
    if ((name === 'project-dialog' || name === 'task-dialog') && isDirty()) {
      askConfirm('編集した内容を破棄しますか？', '保存していない変更があります。編集に戻る場合は、キャンセルを選んでください。', '破棄して閉じる', () => closeDialog(name));
    } else closeDialog(name);
  }
  function clearErrors(kind) {
    $(kind + '-errors').textContent = '';
    $(kind + '-errors').hidden = true;
    $(kind + '-form').querySelectorAll('[aria-invalid]').forEach(field => field.removeAttribute('aria-invalid'));
    $(kind + '-form').querySelectorAll('.field-error').forEach(field => { field.textContent = ''; });
  }
  function showErrors(kind, errors) {
    clearErrors(kind);
    $(kind + '-errors').hidden = false;
    $(kind + '-errors').textContent = '入力内容を確認してください。';
    Object.entries(errors).forEach(([field, message]) => {
      $(kind + '-' + field).setAttribute('aria-invalid', 'true');
      $(kind + '-' + field + '-error').textContent = message;
    });
    $(kind + '-' + Object.keys(errors)[0]).focus();
  }
  function editProject(projectId = null) {
    editingProject = projectId;
    const project = projects.find(item => item.id === projectId);
    $('project-form').reset(); clearErrors('project');
    const fields = project || { title: '', description: '', category: 'guide', status: 'planning', priority: 'normal', dueDate: '' };
    ['title', 'description', 'category', 'status', 'priority', 'dueDate'].forEach(key => { $('project-' + key).value = fields[key]; });
    $('project-dialog-title').textContent = project ? 'プロジェクトを編集' : 'プロジェクトを追加';
    $('save-project').textContent = project ? '変更を保存' : '追加する';
    openDialog('project-dialog');
  }
  function editTask(taskId = null) {
    const project = selectedProject();
    if (!project) return;
    taskProject = project.id; editingTask = taskId;
    const task = project.tasks.find(item => item.id === taskId);
    $('task-form').reset(); clearErrors('task');
    $('task-title').value = task ? task.title : '';
    $('task-done').checked = task ? task.done : false;
    $('task-project-name').textContent = project.title;
    $('task-dialog-title').textContent = task ? 'タスクを編集' : 'タスクを追加';
    $('save-task').textContent = task ? '変更を保存' : '追加する';
    openDialog('task-dialog');
  }

  $('filter-form').addEventListener('submit', event => event.preventDefault());
  $('project-search').addEventListener('input', event => { filters.query = event.target.value; render(); });
  $('category-filter').addEventListener('change', event => { filters.category = event.target.value; render(); });
  $('status-nav').addEventListener('click', event => {
    const button = event.target.closest('[data-status]');
    if (button) { filters.status = button.dataset.status; render(); }
  });
  ['clear-filters', 'empty-reset'].forEach(button => $(button).addEventListener('click', () => { clearFilters(); render(); $('project-search').focus(); }));
  document.addEventListener('click', event => {
    const selection = event.target.closest('[data-select]');
    if (selection) selectProject(selection.dataset.select);
    const close = event.target.closest('[data-close]');
    if (close) requestClose(close.dataset.close);
    const taskEdit = event.target.closest('[data-task-edit]');
    if (taskEdit) editTask(taskEdit.dataset.taskEdit);
    if (event.target.closest('#edit-project')) editProject(selected);
    if (event.target.closest('#add-task')) editTask();
  });
  $('project-detail').addEventListener('change', event => {
    const project = selectedProject();
    if (!project) return;
    const target = event.target;
    if (target.matches('[data-task-check]')) {
      const task = project.tasks.find(item => item.id === target.dataset.taskCheck);
      if (!task) return;
      task.done = target.checked;
      saveAndNotify(task.done ? 'タスクを完了にしました。' : 'タスクを未完了に戻しました。');
      render(target.id);
    } else if (target.id === 'detail-status' || target.id === 'detail-priority') {
      const key = target.id === 'detail-status' ? 'status' : 'priority';
      project[key] = target.value;
      const changed = ensureVisible(project);
      saveAndNotify((key === 'status' ? '状態を「' + M.statuses[project.status] : '優先度を「' + M.priorities[project.priority]) + '」に変更しました。' + changed);
      render(target.id);
    }
  });
  $('add-project').addEventListener('click', () => editProject());
  $('open-help').addEventListener('click', () => openDialog('help-dialog'));
  $('project-form').addEventListener('submit', event => {
    event.preventDefault();
    const result = M.validateProjectInput(Object.fromEntries(new FormData(event.currentTarget)));
    if (!result.valid) { showErrors('project', result.errors); return; }
    if (!editingProject && projects.length >= 100) { showErrors('project', { title: 'このデモでは100件まで追加できます。既存の制作を編集してください。' }); return; }
    let project = projects.find(item => item.id === editingProject);
    if (project) Object.assign(project, result.value);
    else { project = { id: id(), ...result.value, tasks: [] }; projects.unshift(project); }
    selected = project.id;
    const changed = ensureVisible(project);
    closeDialog('project-dialog', false);
    saveAndNotify((editingProject ? 'プロジェクトの変更を保存しました。' : 'プロジェクトを追加しました。') + changed);
    render('detail-title');
  });
  $('task-form').addEventListener('submit', event => {
    event.preventDefault();
    const result = M.validateTaskInput(Object.fromEntries(new FormData(event.currentTarget)));
    if (!result.valid) { showErrors('task', result.errors); return; }
    const project = projects.find(item => item.id === taskProject);
    if (!project) return;
    if (!editingTask && project.tasks.length >= 100) { showErrors('task', { title: '1つの制作につき100件まで追加できます。既存のタスクを編集してください。' }); return; }
    let task = project.tasks.find(item => item.id === editingTask);
    if (task) Object.assign(task, result.value, { done: $('task-done').checked });
    else { task = { id: id(), ...result.value, done: $('task-done').checked }; project.tasks.push(task); }
    selected = project.id;
    const changed = ensureVisible(project);
    closeDialog('task-dialog', false);
    saveAndNotify((editingTask ? 'タスクの変更を保存しました。' : 'タスクを追加しました。') + changed);
    render('check-' + task.id);
  });
  dialogs.forEach(name => $(name).addEventListener('cancel', event => {
    event.preventDefault();
    if (name === 'confirm-dialog') { confirmAction = null; closeDialog(name); }
    else requestClose(name);
  }));
  $('confirm-cancel').addEventListener('click', () => { confirmAction = null; closeDialog('confirm-dialog'); });
  $('confirm-accept').addEventListener('click', () => {
    const action = confirmAction; confirmAction = null;
    closeDialog('confirm-dialog', false);
    if (action) action();
  });
  $('reset-demo').addEventListener('click', () => askConfirm('デモを初期状態に戻しますか？', 'このデモで追加・編集した内容が消え、4件の架空のサンプルに戻ります。他のブラウザデータには触れません。', '初期状態に戻す', () => {
    projects = M.demoProjects(today); selected = projects[0].id; clearFilters(); persistenceBlocked = false;
    saveAndNotify('デモを初期状態に戻しました。'); render(); $('reset-demo').focus();
  }));
  window.addEventListener('beforeunload', event => { if (isDirty()) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('hashchange', () => { if (!activeEditor()) { readRoute(); render(); } });
  document.addEventListener('pointerdown', () => { document.body.dataset.input = 'pointer'; }, { passive: true });
  document.addEventListener('keydown', () => { document.body.dataset.input = 'keyboard'; });
  $('today').textContent = new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Tokyo' }).format(new Date());
  document.body.dataset.input = 'keyboard';
  load(); readRoute(); render();
}());
