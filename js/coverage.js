/*
  COREX — блок «Без нас»: схема связей (секция 2).
  Владеет: переключением #coverage между «как обычно» и «с COREX»
  (сегментный контрол в шапке схемы, счётчик 7→1, список исполнителей)
  и покадровой анимацией SVG-схемы — плашки едут между двумя наборами
  координат за 950мс по easeOutExpo, связи перерисовываются вслед за
  ними. Это JS rAF, а не CSS-transition: меняются координаты кривых
  Безье и transform на SVG-узлах, а не одно свойство одного элемента.

  Разовое появление блока при скролле ведёт общий .reveal (js/reveal.js) —
  этот файл только один раз запускает переход через 2.4с после появления
  схемы в зоне видимости (дальше — по клику) и ничего не знает про
  animations.js/calculator.js/categories.js.
*/
(function () {
  'use strict';

  var section = document.getElementById('coverage');
  var svg = section && section.querySelector('.bn-svg');
  var scheme = section && section.querySelector('.bn-scheme');
  var list = document.getElementById('bnList');
  var seg = document.getElementById('bnSeg');
  var swA = document.getElementById('bnSwitchUsual');
  var swB = document.getElementById('bnSwitchCorex');
  var modeLabel = document.getElementById('bnModeLabel');
  var tallyNum = document.getElementById('bnTallyNum');
  var tallyText = document.getElementById('bnTallyText');
  var linksA = document.getElementById('bnLinksA');
  var linksB = document.getElementById('bnLinksB');
  var nodesG = document.getElementById('bnNodes');

  if (!section || !svg || !scheme || !list || !seg || !swA || !swB || !linksA || !linksB || !nodesG) {
    return;
  }

  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var root = getComputedStyle(document.documentElement);
  var cssVar = function (name) {
    return root.getPropertyValue(name).trim();
  };
  var COLOR_YOU = cssVar('--color-text-on-light');
  var COLOR_COREX = cssVar('--color-accent-primary');
  var COLOR_NODE_STROKE = cssVar('--color-border-on-light-strong');
  var COLOR_LINK_YOU = cssVar('--color-accent-cta');
  var COLOR_LINK_PEER = cssVar('--color-border-on-light-strong');
  var COLOR_LINK_COREX = cssVar('--color-blue-200');

  /* [подпись, x/y «как обычно», x/y «с COREX»] — координаты
     центра плашки, геометрия сцены из docs/ref-bez-nas.html. */
  var NODES = [
    ['Посредник', 300, 46, 438, 58],
    ['Торговый агент', 505, 108, 458, 118],
    ['Инспекция', 262, 148, 438, 178],
    ['Сертификация', 480, 214, 450, 238],
    ['Документы', 258, 254, 438, 298],
    ['Таможня', 490, 318, 430, 358],
    ['Перевозка', 290, 392, 438, 418]
  ];
  var YOU = [54, 228];
  var COREX = [210, 228];
  var LINKS_A = [
    ['y', 0], ['y', 1], ['y', 2], ['y', 3], ['y', 4], ['y', 5], ['y', 6],
    [0, 1], [2, 1], [3, 5], [4, 5], [5, 6]
  ];

  /* -- Вертикальная версия схемы (docs/mobile-spec.md §7) ---------------
     Горизонтальную схему на телефон ужимать нельзя: 620 единиц вьюбокса
     в 320 пикселях экрана дают подписи по 6-7px. Поэтому вторая
     геометрия, портретная: подрядчики столбиком, линии сходятся вниз к
     одному договору.

     Это второй набор координат, а не второй <svg>: рисование, анимация
     перехода, подсветка строк и связь со списком у обеих схем одни и те
     же — в двух разметках пришлось бы держать два экземпляра всего
     движка и синхронизировать их руками. Подставляется набор по
     брейкпоинту, как и требует спека, только переключается не
     видимость, а геометрия.

     Вьюбокс шириной 320 выбран из требования «минимальный размер текста
     в SVG после масштабирования — 12px»: подпись набрана 13 единицами
     (.bn-chip text), на 360px экрана схема получает ~318px ширины, то
     есть масштаб ~0.99 и кегль ~12.9px. Более широкий вьюбокс увёл бы
     подписи под порог. */
  /* Во втором состоянии колонка не выстраивается в одну вертикаль, а
     сужается книзу: при общем x у всех семи связи ложатся друг на друга
     в одну прямую и схождение перестаёт читаться как схождение. Разлёт
     убывает от верхней плашки к нижней — линии видимо сбегаются в
     договор. */
  var NODES_V = [
    ['Посредник', 96, 30, 120, 30],
    ['Торговый агент', 224, 88, 198, 88],
    ['Инспекция', 96, 146, 130, 146],
    ['Сертификация', 224, 204, 190, 204],
    ['Документы', 96, 262, 140, 262],
    ['Таможня', 224, 320, 180, 320],
    ['Перевозка', 96, 378, 158, 378]
  ];
  /* «Вы» внизу, договор — над ним: в состоянии «как обычно» семь связей
     веером уходят вверх мимо пустого места, где потом встанет договор,
     в состоянии «с COREX» они собираются в него. */
  var YOU_V = [160, 596];
  var COREX_V = [160, 496];

  var GEO_H = { nodes: NODES, you: YOU, corex: COREX, vb: '0 0 620 470', vertical: false };
  var GEO_V = { nodes: NODES_V, you: YOU_V, corex: COREX_V, vb: '0 0 320 640', vertical: true };

  var VERT = window.matchMedia('(max-width: 899.98px)');
  var GEO = VERT.matches ? GEO_V : GEO_H;

  var NS = 'http://www.w3.org/2000/svg';
  var mk = function (tag, attrs) {
    var el = document.createElementNS(NS, tag);
    for (var k in attrs) {
      el.setAttribute(k, attrs[k]);
    }
    return el;
  };
  var lerp = function (a, b, t) {
    return a + (b - a) * t;
  };
  var expOut = function (t) {
    return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
  };
  var widthOf = function (s) {
    return Math.round(s.length * 7.9) + 26;
  };

  function chip(label, kind) {
    var w = widthOf(label);
    var h = 32;
    var g = mk('g', { class: 'bn-chip' + (kind === 'you' ? ' bn-chip--you' : kind === 'corex' ? ' bn-chip--corex' : '') });
    var fill = kind === 'you' ? COLOR_YOU : kind === 'corex' ? COLOR_COREX : cssVar('--color-surface-light');
    var stroke = kind === 'you' ? COLOR_YOU : kind === 'corex' ? COLOR_COREX : COLOR_NODE_STROKE;
    g.appendChild(mk('rect', { x: -w / 2, y: -h / 2, width: w, height: h, fill: fill, stroke: stroke, 'stroke-width': 1.2 }));
    var t = mk('text', { x: 0, y: 4.5, 'text-anchor': 'middle' });
    t.textContent = label;
    g.appendChild(t);
    nodesG.appendChild(g);
    g.__w = w;
    return g;
  }

  var youEl = chip('Вы', 'you');
  var corexEl = chip('COREX', 'corex');
  var nodeEls = NODES.map(function (n) {
    return chip(n[0], 'n');
  });

  var pathsA = LINKS_A.map(function (lk) {
    var p = mk('path', {
      fill: 'none',
      stroke: lk[0] === 'y' ? COLOR_LINK_YOU : COLOR_LINK_PEER,
      'stroke-width': lk[0] === 'y' ? 1.5 : 1.1,
      'stroke-linecap': 'round',
      opacity: lk[0] === 'y' ? 0.9 : 0.75
    });
    if (lk[0] === 'y') {
      p.classList.add('bn-flow');
    }
    linksA.appendChild(p);
    return p;
  });
  var pathYC = mk('path', { fill: 'none', stroke: COLOR_COREX, 'stroke-width': 2.4, 'stroke-linecap': 'round' });
  linksB.appendChild(pathYC);
  var pathsB = NODES.map(function () {
    var p = mk('path', { fill: 'none', stroke: COLOR_LINK_COREX, 'stroke-width': 1.2, 'stroke-linecap': 'round' });
    linksB.appendChild(p);
    return p;
  });

  var t = 0;
  var target = 0;
  var raf = null;
  var from = 0;
  var start = 0;

  var cur = function (i) {
    var n = GEO.nodes[i];
    return [lerp(n[1], n[3], t), lerp(n[2], n[4], t)];
  };

  /* Высота плашки фиксирована в chip(); для вертикальной схемы связь
     выходит из верхней или нижней грани, а не из боковой. */
  var CHIP_H = 32;

  function edge(c, w, to) {
    if (GEO.vertical) {
      return to[1] >= c[1] ? [c[0], c[1] + CHIP_H / 2] : [c[0], c[1] - CHIP_H / 2];
    }
    return to[0] >= c[0] ? [c[0] + w / 2, c[1]] : [c[0] - w / 2, c[1]];
  }
  function curve(a, b) {
    if (GEO.vertical) {
      var dy = Math.max(46, Math.abs(b[1] - a[1]) * 0.46) * (b[1] >= a[1] ? 1 : -1);
      return 'M' + a[0] + ' ' + a[1] + ' C' + a[0] + ' ' + (a[1] + dy) + ',' + b[0] + ' ' + (b[1] - dy) + ',' + b[0] + ' ' + b[1];
    }
    var dx = Math.max(46, Math.abs(b[0] - a[0]) * 0.46) * (b[0] >= a[0] ? 1 : -1);
    return 'M' + a[0] + ' ' + a[1] + ' C' + (a[0] + dx) + ' ' + a[1] + ',' + (b[0] - dx) + ' ' + b[1] + ',' + b[0] + ' ' + b[1];
  }

  function draw() {
    var YOU_P = GEO.you;
    var COREX_P = GEO.corex;
    var P = GEO.nodes.map(function (_, i) {
      return cur(i);
    });
    nodeEls.forEach(function (el, i) {
      el.setAttribute('transform', 'translate(' + P[i][0] + ',' + P[i][1] + ')');
    });
    youEl.setAttribute('transform', 'translate(' + YOU_P[0] + ',' + YOU_P[1] + ')');
    corexEl.setAttribute('transform', 'translate(' + COREX_P[0] + ',' + COREX_P[1] + ') scale(' + lerp(0.72, 1, t).toFixed(3) + ')');
    corexEl.setAttribute('opacity', t.toFixed(3));

    LINKS_A.forEach(function (lk, i) {
      var fromC = lk[0] === 'y' ? YOU_P : P[lk[0]];
      var fromW = lk[0] === 'y' ? youEl.__w : nodeEls[lk[0]].__w;
      var toC = P[lk[1]];
      pathsA[i].setAttribute('d', curve(edge(fromC, fromW, toC), edge(toC, nodeEls[lk[1]].__w, fromC)));
    });
    linksA.setAttribute('opacity', (1 - t).toFixed(3));

    pathYC.setAttribute('d', curve(edge(YOU_P, youEl.__w, COREX_P), edge(COREX_P, corexEl.__w, YOU_P)));
    pathsB.forEach(function (p, i) {
      p.setAttribute('d', curve(edge(COREX_P, corexEl.__w, P[i]), edge(P[i], nodeEls[i].__w, COREX_P)));
    });
    linksB.setAttribute('opacity', t.toFixed(3));
  }

  /* Смена геометрии при пересечении 900px: подставить вьюбокс и
     перерисовать в текущем состоянии t. Анимацию не трогаем — переход
     между «как обычно» и «с COREX» к ширине окна отношения не
     имеет. */
  function applyGeometry() {
    GEO = VERT.matches ? GEO_V : GEO_H;
    svg.setAttribute('viewBox', GEO.vb);
    draw();
  }

  applyGeometry();
  if (VERT.addEventListener) {
    VERT.addEventListener('change', applyGeometry);
  }

  function anim(ts) {
    if (!start) {
      start = ts;
    }
    var k = expOut(Math.min(1, (ts - start) / 950));
    t = from + (target - from) * k;
    draw();
    if (k < 1) {
      raf = requestAnimationFrame(anim);
    } else {
      t = target;
      draw();
      raf = null;
    }
  }

  function go(to) {
    if (REDUCE) {
      t = to;
      target = to;
      draw();
    } else {
      from = t;
      target = to;
      start = 0;
      if (raf) {
        cancelAnimationFrame(raf);
      }
      raf = requestAnimationFrame(anim);
    }

    seg.classList.toggle('bn-seg--corex', to === 1);
    seg.classList.remove('bn-seg--hint');
    swA.classList.toggle('is-on', to === 0);
    swB.classList.toggle('is-on', to === 1);
    if (modeLabel) {
      modeLabel.textContent = to === 1 ? 'с COREX' : 'как обычно';
    }
    section.classList.toggle('is-corex', to === 1);
    if (tallyNum) {
      tallyNum.textContent = to === 1 ? '1' : '7';
    }
    if (tallyText) {
      tallyText.textContent = to === 1
        ? 'связь. Один договор, один ответственный за результат — остальных ищем, проверяем и сводим мы'
        : 'связей, которые вы держите сами — и каждую нужно найти, проверить и состыковать с остальными';
    }
  }

  var items = Array.prototype.slice.call(list.children);
  items.forEach(function (li, i) {
    li.addEventListener('mouseenter', function () {
      nodeEls[i].classList.add('bn-chip--hot');
    });
    li.addEventListener('mouseleave', function () {
      nodeEls[i].classList.remove('bn-chip--hot');
    });
  });
  nodeEls.forEach(function (el, i) {
    el.addEventListener('mouseenter', function () {
      el.classList.add('bn-chip--hot');
      items[i].classList.add('is-hot');
    });
    el.addEventListener('mouseleave', function () {
      el.classList.remove('bn-chip--hot');
      items[i].classList.remove('is-hot');
    });
  });

  swA.addEventListener('click', function () {
    go(0);
  });
  swB.addEventListener('click', function () {
    go(1);
  });

  draw();

  var shown = false;
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || shown) {
          return;
        }
        shown = true;
        io.unobserve(entry.target);
        if (REDUCE) {
          go(1);
          return;
        }
        setTimeout(function () {
          go(1);
        }, 2400);
      });
    },
    { threshold: 0.3 }
  );
  io.observe(scheme);
})();
