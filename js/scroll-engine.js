/**
 * COREX — единый планировщик scroll-driven сцен.
 *
 * Заменяет js/scroll-ticker.js. Отличия, ради которых он и написан:
 *
 * 1. Цикл засыпает. Прошлый тикер держал requestAnimationFrame от загрузки
 *    и до закрытия вкладки — хиро и кейсы пересчитывались каждый кадр даже
 *    когда обе сцены были далеко за экраном. Здесь цикл останавливается,
 *    как только у всех видимых блоков |target - p| < SETTLED, и снова
 *    заводится по событию scroll (passive).
 * 2. Блок вне экрана не обновляется вообще (IntersectionObserver на его
 *    треке). При возвращении во вьюпорт блок «схлопывается» на цель одним
 *    кадром (needsSnap), а не доезжает лерпом из устаревшего состояния.
 * 3. Геометрия трека (top/height) кэшируется — при регистрации, на load,
 *    после загрузки шрифтов и при изменении ШИРИНЫ окна. В кадре не
 *    остаётся ни одного getBoundingClientRect/offsetHeight: прогресс
 *    считается из window.scrollY и кэша. Раньше каждая сцена читала
 *    геометрию каждый кадр сразу после того, как предыдущая писала стили —
 *    два принудительных reflow на кадр, это и ощущалось как рывки.
 * 4. Лерп не зависит от частоты кадров: k = 1 - (1 - smooth)^(dt/16.67).
 *    С прежним постоянным шагом 0.09 сцена ехала вдвое быстрее на 120 Гц
 *    и заметно вязла на просадках.
 *
 * Порядок внутри кадра жёсткий: сначала единственное чтение (scrollY),
 * потом только запись стилей в render() блоков.
 *
 * Блок регистрируется так:
 *   window.corexScrollEngine.register({ track: el, render: fn, smooth: 0.09 })
 * где `track` — секция, по которой считается прогресс (её высота минус
 * высота вьюпорта), а `render(p)` получает сглаженный прогресс 0..1 и
 * только пишет стили. Сам лерп и кэш геометрии — здесь, в одном месте.
 */
(function () {
  'use strict';

  var SETTLED = 0.0005;
  var DEFAULT_SMOOTH = 0.09;
  var REF_FRAME = 16.67;

  var blocks = [];
  var running = false;
  var lastTs = 0;
  var scrollY = 0;
  var viewportH = 0;
  var viewportW = 0;
  var observer = null;

  function clamp(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function readScroll() {
    scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  }

  /* Все чтения раскладки — только здесь, пачкой, вне кадра анимации. */
  function measureAll() {
    viewportH = window.innerHeight;
    viewportW = window.innerWidth;
    readScroll();
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      var rect = b.track.getBoundingClientRect();
      b.top = rect.top + scrollY;
      b.span = b.track.offsetHeight - viewportH;
      b.needsSnap = true;
    }
    request();
  }

  function progressOf(b) {
    return b.span > 0 ? clamp((scrollY - b.top) / b.span) : 0;
  }

  function frame(ts) {
    var dt = lastTs ? Math.min(ts - lastTs, 100) : REF_FRAME;
    lastTs = ts;

    // Единственное чтение раскладки в кадре — до любых записей.
    readScroll();

    var busy = false;
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (!b.visible) {
        continue;
      }

      var target = progressOf(b);
      if (b.needsSnap) {
        b.needsSnap = false;
        b.p = target;
      } else {
        var k = 1 - Math.pow(1 - b.smooth, dt / REF_FRAME);
        b.p += (target - b.p) * k;
      }

      if (Math.abs(target - b.p) < SETTLED) {
        b.p = target;
      } else {
        busy = true;
      }

      b.render(b.p);
    }

    if (busy) {
      requestAnimationFrame(frame);
    } else {
      running = false;
      lastTs = 0;
    }
  }

  function request() {
    if (running) {
      return;
    }
    running = true;
    lastTs = 0;
    requestAnimationFrame(frame);
  }

  function ensureObserver() {
    if (observer || typeof IntersectionObserver !== 'function') {
      return;
    }
    observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        for (var j = 0; j < blocks.length; j++) {
          if (blocks[j].track !== entry.target) {
            continue;
          }
          var was = blocks[j].visible;
          blocks[j].visible = entry.isIntersecting;
          if (entry.isIntersecting && !was) {
            // Возврат во вьюпорт: показать верное состояние сразу,
            // а не доезжать лерпом из того, где сцену бросили.
            blocks[j].needsSnap = true;
          }
        }
      }
      request();
    });
  }

  function register(options) {
    if (!options || !options.track || typeof options.render !== 'function') {
      return;
    }

    var block = {
      track: options.track,
      render: options.render,
      smooth: options.smooth || DEFAULT_SMOOTH,
      top: 0,
      span: 0,
      p: 0,
      needsSnap: true,
      visible: true
    };
    blocks.push(block);

    ensureObserver();
    if (observer) {
      // До первой доставки observer'а блок считается видимым — иначе
      // сцена не отрисовалась бы вовсе, если страница открыта уже
      // проскролленной до неё.
      observer.observe(block.track);
    }

    measureAll();

    // Первый кадр рисуем синхронно, ещё до rAF: иначе между разбором
    // скрипта и первым тиком сцена успевает мелькнуть в CSS-дефолте
    // (у кейсов это все пять документов стопкой в полную непрозрачность).
    block.p = progressOf(block);
    block.needsSnap = false;
    block.render(block.p);
  }

  window.addEventListener('scroll', request, { passive: true });

  // Ширина не менялась — не пересчитываем ничего: на мобильных появление
  // и скрытие адресной строки шлёт resize с той же шириной, и пересчёт
  // кэша на нём давал бы скачок сцены на ровном месте.
  var resizeTimer;
  window.addEventListener('resize', function () {
    if (window.innerWidth === viewportW) {
      return;
    }
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(measureAll, 150);
  }, { passive: true });

  // Шрифты и картинки меняют высоту документа уже после первой раскладки.
  window.addEventListener('load', measureAll);
  if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
    document.fonts.ready.then(measureAll);
  }

  /* ==========================================================
     Плавный переход к якорям.

     Взамен снятого `html { scroll-behavior: smooth }` (css/styles.css §0):
     глобальное правило распространялось на любую прокрутку, включая ту,
     которую браузер делает сам — и его анимация шла вразнобой с лерпом
     сцен. Здесь плавность включается только по клику по внутренней
     ссылке, одним делегированным обработчиком на документ.

     prefers-reduced-motion — мгновенный переход (docs/motion-spec.md,
     п.8: конечное состояние, а не отключение навигации).
     Skip-link не перехватываем: ему нужен обычный мгновенный переход
     вместе с переносом фокуса.
     ========================================================== */
  document.addEventListener('click', function (event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    var link = event.target.closest ? event.target.closest('a[href^="#"]') : null;
    if (!link || link.classList.contains('skip-link')) {
      return;
    }

    var id = link.getAttribute('href').slice(1);
    if (!id) {
      return;
    }

    var targetEl = document.getElementById(id);
    if (!targetEl) {
      return;
    }

    event.preventDefault();
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var top = targetEl.getBoundingClientRect().top + (window.pageYOffset || 0);
    window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });

    if (link.hash !== window.location.hash) {
      history.replaceState(null, '', link.hash);
    }
  });

  window.corexScrollEngine = { register: register, remeasure: measureAll };
})();
