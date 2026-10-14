(function (root) {
  'use strict';
  const statuses = { planning: '準備中', active: '進行中', review: '確認待ち', done: '完了' };
  const categories = { guide: 'ガイド', app: 'アプリ', game: 'ゲーム', other: 'その他' };
  const priorities = { high: '高', normal: '通常', low: '低' };
  const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase('ja').trim();
  const isDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value + 'T00:00:00Z').getTime()) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
  function dateOffset(date, offset) {
    const value = new Date(date + 'T00:00:00Z');
    value.setUTCDate(value.getUTCDate() + offset);
    return value.toISOString().slice(0, 10);
  }
  function demoProjects(today) {
    return [
      { id: 'demo-ui', title: 'UI UX guide', category: 'guide', description: 'UIの設計から操作の仕上げまで。日本語で読めるガイドの、画面サンプルをつくる。', status: 'active', priority: 'high', dueDate: dateOffset(today, 2), tasks: [
        { id: 'ui-1', title: '使うスキルと目的を決める', done: true }, { id: 'ui-2', title: '制作ダッシュボードの操作をつなぐ', done: false }, { id: 'ui-3', title: 'スマートフォンとキーボードで確認する', done: false }, { id: 'ui-4', title: '使い方と適用したスキルをまとめる', done: false }
      ] },
      { id: 'demo-motion', title: 'Motion guide', category: 'guide', description: '映像づくりに使う道具を、目的から選べるように整理する。今回は掲載項目の見直し。', status: 'review', priority: 'normal', dueDate: dateOffset(today, 1), tasks: [
        { id: 'motion-1', title: '項目を用途ごとに分類する', done: true }, { id: 'motion-2', title: '紹介文と原典リンクをそろえる', done: true }, { id: 'motion-3', title: '第三者に選びやすさを確認してもらう', done: false }
      ] },
      { id: 'demo-slides', title: 'Slides guide', category: 'guide', description: 'スライドを組み立てる流れと、依頼のしかたをまとめる。まずは構成から。', status: 'planning', priority: 'low', dueDate: dateOffset(today, 7), tasks: [
        { id: 'slides-1', title: '読者と利用場面を決める', done: false }, { id: 'slides-2', title: '章立ての候補を出す', done: false }
      ] },
      { id: 'demo-game', title: 'Game prototype', category: 'game', description: '小さなゲームのメニューを試作。迷わず遊び始められる導線を確かめる。', status: 'active', priority: 'normal', dueDate: dateOffset(today, 5), tasks: [
        { id: 'game-1', title: '最初の画面の役割を決める', done: true }, { id: 'game-2', title: '設定メニューの開閉を実装する', done: false }, { id: 'game-3', title: '文字サイズと操作順を確認する', done: false }
      ] }
    ];
  }
  function validateProjectInput(input) {
    const value = { title: String(input.title || '').trim(), description: String(input.description || '').trim(),
      category: String(input.category || ''), status: String(input.status || ''), priority: String(input.priority || ''), dueDate: String(input.dueDate || '') };
    const errors = {};
    if (!value.title) errors.title = 'プロジェクト名を入力してください。';
    else if (value.title.length > 80) errors.title = 'プロジェクト名は80文字以内にしてください。';
    if (value.description.length > 600) errors.description = '説明は600文字以内にしてください。';
    if (!Object.hasOwn(categories, value.category)) errors.category = '分野を選んでください。';
    if (!Object.hasOwn(statuses, value.status)) errors.status = '状態を選んでください。';
    if (!Object.hasOwn(priorities, value.priority)) errors.priority = '優先度を選んでください。';
    if (value.dueDate && !isDate(value.dueDate)) errors.dueDate = '有効な日付を入力してください。';
    return { value, errors, valid: Object.keys(errors).length === 0 };
  }
  function validateTaskInput(input) {
    const title = String(input.title || '').trim();
    const errors = {};
    if (!title) errors.title = 'タスク名を入力してください。';
    else if (title.length > 120) errors.title = 'タスク名は120文字以内にしてください。';
    return { value: { title }, errors, valid: Object.keys(errors).length === 0 };
  }
  function filterProjects(projects, filters) {
    const terms = normalize(filters.query).split(/\s+/u).filter(Boolean);
    return projects.filter(project => {
      if (filters.status !== 'all' && project.status !== filters.status) return false;
      if (filters.category !== 'all' && project.category !== filters.category) return false;
      const text = normalize([project.title, project.description, categories[project.category], ...project.tasks.map(t => t.title)].join(' '));
      return terms.every(term => text.includes(term));
    });
  }
  function progress(project) {
    const total = project.tasks.length;
    const done = project.tasks.filter(task => task.done).length;
    return { done, total, percent: total ? Math.round(done / total * 100) : 0 };
  }
  function nextTasks(projects, limit = 3) {
    const ranks = { high: 0, normal: 1, low: 2 };
    return [...projects].filter(project => project.status !== 'done').sort((a, b) => ranks[a.priority] - ranks[b.priority] || (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
      .flatMap(project => {
        const task = project.tasks.find(item => !item.done);
        return task ? [{ project, task }] : [];
      }).slice(0, limit);
  }
  function isPersistedState(value) {
    if (!value || value.version !== 1 || !Array.isArray(value.projects) || value.projects.length > 100) return false;
    const ids = new Set();
    return value.projects.every(project => {
      if (!project || typeof project.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(project.id) || ids.has(project.id)) return false;
      ids.add(project.id);
      if (!['title', 'description', 'category', 'status', 'priority', 'dueDate'].every(key => typeof project[key] === 'string')) return false;
      if (!validateProjectInput(project).valid || !Array.isArray(project.tasks) || project.tasks.length > 100) return false;
      const taskIds = new Set();
      return project.tasks.every(task => {
        if (!task || typeof task.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(task.id) || taskIds.has(task.id)) return false;
        taskIds.add(task.id);
        return typeof task.title === 'string' && validateTaskInput(task).valid && typeof task.done === 'boolean';
      });
    });
  }
  const api = { statuses, categories, priorities, normalize, isDate, demoProjects, validateProjectInput, validateTaskInput, filterProjects, progress, nextTasks, isPersistedState };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StudioDeskModel = api;
}(typeof window === 'undefined' ? null : window));
