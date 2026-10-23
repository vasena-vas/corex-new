/*
  COREX — точечный редактор текста на статичных блоках.
  Помечает элементы с [data-edit-id] как редактируемые прямо в браузере;
  правки сохраняются в localStorage и переживают перезагрузку страницы
  на этом же устройстве (это не CMS и не общее хранилище на сервере —
  каждый браузер видит только свои собственные правки).
  Не знает про calculator.js/contact-form.js/animations.js.
*/
(function () {
  var STORAGE_KEY = 'corex-trade-text-edits-v1';
  var editMode = false;

  function loadEdits() {
    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || {};
    } catch (err) {
      return {};
    }
  }

  function saveEdit(id, text) {
    var edits = loadEdits();
    edits[id] = text;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(edits));
    } catch (err) {
      /* localStorage недоступен (приватный режим, квота) — правка останется только в DOM до перезагрузки. */
    }
  }

  function applyEdits() {
    var edits = loadEdits();
    var nodes = document.querySelectorAll('[data-edit-id]');
    for (var i = 0; i < nodes.length; i++) {
      var id = nodes[i].getAttribute('data-edit-id');
      if (Object.prototype.hasOwnProperty.call(edits, id)) {
        nodes[i].textContent = edits[id];
      }
    }
  }

  // Применяем сохранённые правки сразу: скрипт подключён в конце body,
  // после всей разметки, но до animations.js — GSAP должен считать
  // размеры уже с финальным текстом пользователя.
  applyEdits();

  function setEditMode(on, toggleBtn) {
    editMode = on;
    document.body.classList.toggle('edit-mode', on);
    var nodes = document.querySelectorAll('[data-edit-id]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].setAttribute('contenteditable', on ? 'true' : 'false');
    }
    toggleBtn.setAttribute('aria-pressed', String(on));
    toggleBtn.textContent = on ? 'Готово' : 'Редактировать текст';
  }

  function onFocusOut(e) {
    if (!editMode) return;
    var el = e.target.closest && e.target.closest('[data-edit-id]');
    if (!el) return;
    saveEdit(el.getAttribute('data-edit-id'), el.textContent.replace(/\s+/g, ' ').trim());
  }

  function onKeyDown(e) {
    if (!editMode || e.key !== 'Enter') return;
    if (!e.target.closest || !e.target.closest('[data-edit-id]')) return;
    // Однострочная правка: Enter завершает редактирование вместо переноса строки внутри contenteditable.
    e.preventDefault();
    e.target.blur();
  }

  function onClickGuard(e) {
    if (!editMode) return;
    if (!e.target.closest || !e.target.closest('[data-edit-id]')) return;
    var link = e.target.closest('a[href]');
    if (link) e.preventDefault();
  }

  function buildPanel() {
    var panel = document.createElement('div');
    panel.className = 'inline-editor-panel';

    var toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'inline-editor-panel__btn';
    toggleBtn.id = 'inline-editor-toggle';
    toggleBtn.setAttribute('aria-pressed', 'false');
    toggleBtn.title = 'Кликните на текст на странице, чтобы отредактировать его. Правки сохраняются в этом браузере.';
    toggleBtn.textContent = 'Редактировать текст';

    var resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'inline-editor-panel__btn inline-editor-panel__reset';
    resetBtn.id = 'inline-editor-reset';
    resetBtn.textContent = 'Сбросить правки';

    toggleBtn.addEventListener('click', function () {
      setEditMode(!editMode, toggleBtn);
    });

    resetBtn.addEventListener('click', function () {
      if (window.confirm('Вернуть исходный текст на всей странице? Ваши правки будут удалены.')) {
        window.localStorage.removeItem(STORAGE_KEY);
        window.location.reload();
      }
    });

    panel.appendChild(toggleBtn);
    panel.appendChild(resetBtn);
    document.body.appendChild(panel);

    document.body.addEventListener('focusout', onFocusOut, true);
    document.body.addEventListener('keydown', onKeyDown, true);
    document.body.addEventListener('click', onClickGuard, true);
  }

  buildPanel();
})();
