/*
  COREX — панель «Оформление»: живая настройка цвета, цвета текста,
  шрифта, размера текста и яркости прямо на сайте.
  Работает поверх css/tokens.css: перезаписывает CSS-переменные через
  document.documentElement.style, ничего не трогает в разметке (в отличие
  от js/inline-editor.js, который правит текст в самих узлах DOM).
  Настройки хранятся в localStorage конкретного браузера.
*/
(function () {
  var STORAGE_KEY = 'corex-trade-appearance-v1';

  // 7 цветовых тем — та же лестница светлоты/насыщенности, что и в
  // исходной синей палитре tokens.css, со сдвигом оттенка (см. DESIGN_SYSTEM.md
  // §Палитра). Красный CTA намеренно не входит ни в одну тему — он остаётся
  // единичным акцентом при любом цвете сайта.
  var THEMES = {
    blue: {
      label: 'Синий',
      blue: { 950: '#07203f', 900: '#0c3466', 800: '#124584', 700: '#1a5aa8', 600: '#2071c9', 500: '#2b8fe0', 400: '#3fb0f2', 300: '#7ecbf5', 200: '#b3e2f8', 100: '#e2f5fd' },
      teal: { 600: '#0e7370', 500: '#17b3ab', 400: '#35ddce', 300: '#85f2e0' }
    },
    teal: {
      label: 'Бирюза',
      blue: { 950: '#07343f', 900: '#0c5466', 800: '#126d84', 700: '#1a8ca8', 600: '#20acc9', 500: '#2bcee0', 400: '#3feff2', 300: '#7ef5f5', 200: '#b3f8f6', 100: '#e2fdfc' },
      teal: { 600: '#0e734d', 500: '#17b374', 400: '#35dd93', 300: '#85f2ba' }
    },
    green: {
      label: 'Зелёный',
      blue: { 950: '#083e29', 900: '#0e6443', 800: '#158158', 700: '#1ea471', 600: '#24c583', 500: '#30db88', 400: '#43ee8e', 300: '#81f2b0', 200: '#b5f6ce', 100: '#e3fcec' },
      teal: { 600: '#117014', 500: '#1baf1d', 400: '#3dd939', 300: '#92ef88' }
    },
    violet: {
      label: 'Фиолетовый',
      blue: { 950: '#250a3c', 900: '#3c1062', 800: '#4f187e', 700: '#6521a1', 600: '#7528c1', 500: '#7a34d7', 400: '#8148e9', 300: '#a884ef', 200: '#c9b6f5', 100: '#eae3fc' },
      teal: { 600: '#13176e', 500: '#1f28ab', 400: '#3d4dd5', 300: '#8a9ced' }
    },
    magenta: {
      label: 'Малиновый',
      blue: { 950: '#3b0b1d', 900: '#5f1330', 800: '#7b1b3f', 700: '#9d2553', 600: '#bc2d68', 500: '#d23983', 400: '#e54ca2', 300: '#ec87c2', 200: '#f3b8dc', 100: '#fbe4f3' },
      teal: { 600: '#6b1668', 500: '#a723a5', 400: '#cd42d0', 300: '#e18dea' }
    },
    amber: {
      label: 'Оранжевый',
      blue: { 950: '#39280d', 900: '#5d4215', 800: '#79561d', 700: '#9a6e28', 600: '#b88031', 500: '#ce883d', 400: '#e08f51', 300: '#e9b28a', 200: '#f1cfba', 100: '#faede5' },
      teal: { 600: '#691b18', 500: '#a32927', 400: '#cc4649', 300: '#e79098' }
    },
    graphite: {
      label: 'Графит',
      blue: { 950: '#202326', 900: '#34383e', 800: '#444a52', 700: '#58606a', 600: '#6a747f', 500: '#7b8790', 400: '#8e9ba3', 300: '#b2bcc1', 200: '#d1d7da', 100: '#eef0f1' },
      teal: { 600: '#3a4746', 500: '#5c6e6d', 400: '#7f9391', 300: '#b5c2c0' }
    }
  };

  var TEXT_COLORS = [
    { key: 'default', label: 'По умолчанию', value: '#101826' },
    { key: 'black', label: 'Чёрный', value: '#000000' },
    { key: 'graphite', label: 'Графитовый', value: '#33383f' },
    { key: 'forest', label: 'Тёмно-зелёный', value: '#0f3d2e' },
    { key: 'espresso', label: 'Тёмно-коричневый', value: '#3a2418' },
    { key: 'maroon', label: 'Бордовый', value: '#4a1420' }
  ];

  // Google Fonts подключаются только если посетитель сам выберет не-дефолтный
  // шрифт в панели — на обычной загрузке сайта используется только
  // self-hosted Golos Text (см. DESIGN_SYSTEM.md §Типографика).
  var FONT_DEFAULT_STACK = "'Golos Text', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
  var FONTS = [
    { key: 'default', label: 'Golos Text', family: null, stack: FONT_DEFAULT_STACK },
    { key: 'inter', label: 'Inter', family: 'Inter', query: 'Inter:wght@400..800' },
    { key: 'montserrat', label: 'Montserrat', family: 'Montserrat', query: 'Montserrat:wght@400..800' },
    { key: 'rubik', label: 'Rubik', family: 'Rubik', query: 'Rubik:wght@400..800' },
    { key: 'onest', label: 'Onest', family: 'Onest', query: 'Onest:wght@400..800' },
    { key: 'nunito', label: 'Nunito Sans', family: 'Nunito Sans', query: 'Nunito+Sans:wght@400..800' }
  ];

  var FONT_SCALE_MIN = 0.85;
  var FONT_SCALE_MAX = 1.3;
  var BRIGHTNESS_MIN = 0.75;
  var BRIGHTNESS_MAX = 1.3;

  var DEFAULT_STATE = {
    theme: 'blue',
    textColor: 'default',
    font: 'default',
    fontScale: 1,
    brightness: 1
  };

  var state = loadState();
  var loadedFontLinks = {};
  var root = document.documentElement;

  function loadState() {
    try {
      var saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      if (!saved || typeof saved !== 'object') return clone(DEFAULT_STATE);
      var merged = clone(DEFAULT_STATE);
      for (var k in DEFAULT_STATE) {
        if (Object.prototype.hasOwnProperty.call(saved, k)) merged[k] = saved[k];
      }
      return merged;
    } catch (err) {
      return clone(DEFAULT_STATE);
    }
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function saveState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      /* localStorage недоступен — настройка останется только в этой вкладке. */
    }
  }

  // -- hex <-> HSL, только для расчёта яркости тёмных фоновых тонов -------

  function hexToHsl(hex) {
    var r = parseInt(hex.slice(1, 3), 16) / 255;
    var g = parseInt(hex.slice(3, 5), 16) / 255;
    var b = parseInt(hex.slice(5, 7), 16) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4;
      }
      h *= 60;
    }
    return [h, s * 100, l * 100];
  }

  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = l - c / 2;
    var r, g, b;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    var toHex = function (v) {
      var n = Math.round((v + m) * 255);
      return ('0' + Math.max(0, Math.min(255, n)).toString(16)).slice(-2);
    };
    return '#' + toHex(r) + toHex(g) + toHex(b);
  }

  function lighten(hex, deltaPercentPoints) {
    var hsl = hexToHsl(hex);
    return hslToHex(hsl[0], hsl[1], hsl[2] + deltaPercentPoints);
  }

  // -- применение состояния -------------------------------------------------

  function applyTheme() {
    var theme = THEMES[state.theme] || THEMES.blue;
    // Яркость сдвигает лестность только тёмных фоновых ступеней —
    // акцентные/светлые тона (500 и светлее) остаются как в теме,
    // иначе кнопки/фокус-кольцо на светлых секциях теряют контраст.
    var delta = (state.brightness - 1) * 45;
    var darkBlueStops = [950, 900, 800, 700, 600];
    var darkTealStops = [600];

    Object.keys(theme.blue).forEach(function (stop) {
      var base = theme.blue[stop];
      var value = darkBlueStops.indexOf(Number(stop)) !== -1 ? lighten(base, delta) : base;
      root.style.setProperty('--color-blue-' + stop, value);
    });
    Object.keys(theme.teal).forEach(function (stop) {
      var base = theme.teal[stop];
      var value = darkTealStops.indexOf(Number(stop)) !== -1 ? lighten(base, delta) : base;
      root.style.setProperty('--color-teal-' + stop, value);
    });
  }

  function applyTextColor() {
    var entry = TEXT_COLORS.filter(function (c) { return c.key === state.textColor; })[0] || TEXT_COLORS[0];
    root.style.setProperty('--color-text-on-light', entry.value);
  }

  function ensureFontLoaded(entry) {
    if (!entry.family || loadedFontLinks[entry.key]) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + entry.query + '&display=swap';
    document.head.appendChild(link);
    loadedFontLinks[entry.key] = true;
  }

  function applyFont() {
    var entry = FONTS.filter(function (f) { return f.key === state.font; })[0] || FONTS[0];
    if (entry.family) {
      ensureFontLoaded(entry);
      root.style.setProperty('--font-family-base', "'" + entry.family + "', " + FONT_DEFAULT_STACK);
    } else {
      root.style.removeProperty('--font-family-base');
    }
  }

  function applyFontScale() {
    root.style.setProperty('--user-font-scale', String(state.fontScale));
  }

  function applyBrightness() {
    root.style.setProperty('--user-brightness', String(state.brightness));
    applyTheme(); // яркость пересчитывает тёмные ступени текущей темы заново
  }

  function applyAll() {
    applyTheme();
    applyTextColor();
    applyFont();
    applyFontScale();
    applyBrightness();
  }

  applyAll();

  // -- UI ---------------------------------------------------------------

  function fmtPercent(v) {
    return Math.round(v * 100) + '%';
  }

  function buildPanel() {
    var panel = document.createElement('div');
    panel.className = 'appearance-panel';

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'inline-editor-panel__btn appearance-panel__toggle';
    toggle.id = 'appearance-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'appearance-drawer');
    toggle.textContent = 'Оформление';

    var drawer = document.createElement('div');
    drawer.className = 'appearance-drawer';
    drawer.id = 'appearance-drawer';
    drawer.hidden = true;

    // -- цвет темы --
    var themeSection = document.createElement('div');
    themeSection.className = 'appearance-drawer__section';
    var themeLabel = document.createElement('p');
    themeLabel.className = 'appearance-drawer__label';
    themeLabel.textContent = 'Цвет';
    var themeSwatches = document.createElement('div');
    themeSwatches.className = 'appearance-swatches';
    Object.keys(THEMES).forEach(function (key) {
      var t = THEMES[key];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'appearance-swatch';
      btn.style.setProperty('--swatch-color', t.blue[500]);
      btn.title = t.label;
      btn.setAttribute('aria-label', t.label);
      btn.setAttribute('aria-pressed', String(state.theme === key));
      btn.addEventListener('click', function () {
        state.theme = key;
        applyTheme();
        saveState();
        updatePressedState(themeSwatches, key);
      });
      themeSwatches.appendChild(btn);
    });
    themeSection.appendChild(themeLabel);
    themeSection.appendChild(themeSwatches);

    // -- цвет текста --
    var textSection = document.createElement('div');
    textSection.className = 'appearance-drawer__section';
    var textLabel = document.createElement('p');
    textLabel.className = 'appearance-drawer__label';
    textLabel.textContent = 'Цвет текста';
    var textSwatches = document.createElement('div');
    textSwatches.className = 'appearance-swatches';
    TEXT_COLORS.forEach(function (c) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'appearance-swatch';
      btn.style.setProperty('--swatch-color', c.value);
      btn.title = c.label;
      btn.setAttribute('aria-label', c.label);
      btn.setAttribute('aria-pressed', String(state.textColor === c.key));
      btn.addEventListener('click', function () {
        state.textColor = c.key;
        applyTextColor();
        saveState();
        updatePressedState(textSwatches, c.key);
      });
      textSwatches.appendChild(btn);
    });
    textSection.appendChild(textLabel);
    textSection.appendChild(textSwatches);

    function updatePressedState(container, activeKey) {
      var btns = container.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        btns[i].setAttribute('aria-pressed', String(btns[i]._key === activeKey));
      }
    }

    // aria-pressed выше завязан на data-атрибут, проставим ключи явно
    Array.prototype.forEach.call(themeSwatches.children, function (btn, i) {
      btn._key = Object.keys(THEMES)[i];
    });
    Array.prototype.forEach.call(textSwatches.children, function (btn, i) {
      btn._key = TEXT_COLORS[i].key;
    });

    // -- шрифт --
    var fontSection = document.createElement('div');
    fontSection.className = 'appearance-drawer__section';
    var fontLabel = document.createElement('p');
    fontLabel.className = 'appearance-drawer__label';
    fontLabel.textContent = 'Шрифт';
    var fontList = document.createElement('div');
    fontList.className = 'appearance-fonts';
    FONTS.forEach(function (f) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'appearance-font-btn';
      btn.textContent = f.label;
      btn.setAttribute('aria-pressed', String(state.font === f.key));
      btn.addEventListener('click', function () {
        state.font = f.key;
        applyFont();
        saveState();
        var btns = fontList.querySelectorAll('button');
        for (var i = 0; i < btns.length; i++) {
          btns[i].setAttribute('aria-pressed', String(FONTS[i].key === f.key));
        }
      });
      fontList.appendChild(btn);
    });
    fontSection.appendChild(fontLabel);
    fontSection.appendChild(fontList);

    // -- размер текста --
    var sizeSection = document.createElement('div');
    sizeSection.className = 'appearance-drawer__section';
    var sizeLabel = document.createElement('label');
    sizeLabel.className = 'appearance-drawer__label';
    sizeLabel.setAttribute('for', 'appearance-font-scale');
    sizeLabel.textContent = 'Размер текста';
    var sizeRow = document.createElement('div');
    sizeRow.className = 'appearance-drawer__slider-row';
    var sizeInput = document.createElement('input');
    sizeInput.type = 'range';
    sizeInput.className = 'appearance-range';
    sizeInput.id = 'appearance-font-scale';
    sizeInput.min = String(FONT_SCALE_MIN);
    sizeInput.max = String(FONT_SCALE_MAX);
    sizeInput.step = '0.05';
    sizeInput.value = String(state.fontScale);
    var sizeValue = document.createElement('span');
    sizeValue.className = 'appearance-drawer__value';
    sizeValue.textContent = fmtPercent(state.fontScale);
    sizeInput.addEventListener('input', function () {
      state.fontScale = parseFloat(sizeInput.value);
      sizeValue.textContent = fmtPercent(state.fontScale);
      applyFontScale();
    });
    sizeInput.addEventListener('change', function () {
      saveState();
      // Изменение размера текста меняет высоту секций — scroll-триггеры
      // остальных секций (GSAP ScrollTrigger, см. js/animations.js; Hero
      // на нём не завязан, см. js/hero-panorama.js) должны пересчитать
      // стартовые/конечные точки, иначе анимация "поедет" после ресайза.
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    });
    sizeRow.appendChild(sizeInput);
    sizeRow.appendChild(sizeValue);
    sizeSection.appendChild(sizeLabel);
    sizeSection.appendChild(sizeRow);

    // -- яркость --
    var brightSection = document.createElement('div');
    brightSection.className = 'appearance-drawer__section';
    var brightLabel = document.createElement('label');
    brightLabel.className = 'appearance-drawer__label';
    brightLabel.setAttribute('for', 'appearance-brightness');
    brightLabel.textContent = 'Яркость';
    var brightRow = document.createElement('div');
    brightRow.className = 'appearance-drawer__slider-row';
    var brightInput = document.createElement('input');
    brightInput.type = 'range';
    brightInput.className = 'appearance-range';
    brightInput.id = 'appearance-brightness';
    brightInput.min = String(BRIGHTNESS_MIN);
    brightInput.max = String(BRIGHTNESS_MAX);
    brightInput.step = '0.05';
    brightInput.value = String(state.brightness);
    var brightValue = document.createElement('span');
    brightValue.className = 'appearance-drawer__value';
    brightValue.textContent = fmtPercent(state.brightness);
    brightInput.addEventListener('input', function () {
      state.brightness = parseFloat(brightInput.value);
      brightValue.textContent = fmtPercent(state.brightness);
      applyBrightness();
    });
    brightInput.addEventListener('change', saveState);
    brightRow.appendChild(brightInput);
    brightRow.appendChild(brightValue);
    brightSection.appendChild(brightLabel);
    brightSection.appendChild(brightRow);

    // -- сброс --
    var resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'appearance-drawer__reset';
    resetBtn.textContent = 'Сбросить оформление';
    resetBtn.addEventListener('click', function () {
      state = clone(DEFAULT_STATE);
      saveState();
      applyAll();
      updatePressedState(themeSwatches, state.theme);
      updatePressedState(textSwatches, state.textColor);
      var fontBtns = fontList.querySelectorAll('button');
      for (var i = 0; i < fontBtns.length; i++) {
        fontBtns[i].setAttribute('aria-pressed', String(FONTS[i].key === state.font));
      }
      sizeInput.value = String(state.fontScale);
      sizeValue.textContent = fmtPercent(state.fontScale);
      brightInput.value = String(state.brightness);
      brightValue.textContent = fmtPercent(state.brightness);
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    });

    drawer.appendChild(themeSection);
    drawer.appendChild(textSection);
    drawer.appendChild(fontSection);
    drawer.appendChild(sizeSection);
    drawer.appendChild(brightSection);
    drawer.appendChild(resetBtn);

    toggle.addEventListener('click', function () {
      var open = drawer.hidden;
      drawer.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
    });

    panel.appendChild(toggle);
    panel.appendChild(drawer);
    document.body.appendChild(panel);
  }

  buildPanel();
})();
