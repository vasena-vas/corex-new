/**
 * COREX — хиро, горизонтальная панорама.
 *
 * Принцип, обоснование и правила доработки — docs/hero-panorama.md.
 * Логика ниже перенесена из docs/hero-panorama-reference.html почти без
 * изменений (только id/классы под разметку index.html) — код панорамы
 * менять здесь не проектируя заново, а только синхронно с этим файлом
 * и docs/hero-panorama-reference.html.
 *
 * Генератора реквизита вдоль дороги здесь больше нет: ящики, бочки,
 * конусы, контейнеры и указатели «далее — …» сняты вместе с силуэтами
 * города и кранами. Станции — фотореалистичные рендеры
 * (assets/hero/station-0N.webp), и штриховая графика рядом с ними
 * читалась как чужая. На станции остались её рендер, текст шага и линия
 * маршрута с узлами; центры станций по-прежнему на 60/160/260/360/460/560vw.
 *
 * Движок прогресса вынесен целиком в js/scroll-engine.js: там и кэш
 * геометрии секции, и лерп, и сон цикла. Здесь остаётся только
 * render(p) — чистая запись стилей из готового прогресса, без единого
 * чтения раскладки в кадре. Детерминированный p (а не событийные
 * переключения) обязателен: иначе сцена не отматывается назад при
 * скролле вверх. Из `p` выводятся позиция камеры (--hero-cam) и
 * видимость вступления/этапов. Не зависит от GSAP.
 *
 * В кадре пишутся только transform/opacity и переменная --hero-cam.
 * Расфокус вступления (filter: blur) убран сознательно: blur каждый
 * кадр перерисовывает весь слой текста, а уход вступления и без него
 * полностью читается по opacity + подъёму + масштабу.
 */
(function () {
  var track = document.getElementById('hero');
  var pin = document.getElementById('hero-pin');
  var intro = document.getElementById('hero-intro');
  var wash = document.getElementById('hero-wash');
  var hint = document.getElementById('hero-hint');
  var counter = document.getElementById('hero-counter');
  if (!track || !pin || !intro || !wash || !hint || !counter) return;

  var acts = [].slice.call(document.querySelectorAll('.hero__act'));
  var nodes = [].slice.call(document.querySelectorAll('.hero__node'));
  if (acts.length !== 6 || nodes.length !== 6) return;

  /* Два единственных потребителя позиции камеры. Раньше она писалась
     переменной --hero-cam на #hero-pin, и это стоило дороже всего в кадре:
     запись кастомного свойства на предка инвалидирует стиль всему
     поддереву, а под пином лежит весь хиро — шесть станций с картинками,
     шесть текстовых блоков, вуаль, грейд, зерно, аберрация. Замер на
     390x844 с троттлингом 4x: 2 пересчёта стиля и 7.5ms на кадр при
     layout 0.08 и JS 1.1ms — то есть почти весь бюджет уходил на стиль.

     Теперь слой получает transform напрямую, а --hero-cam ставится на
     .hero__road-done — у неё нет потомков, и инвалидация никуда не идёт.
     Числа на экране те же: формула слоя (-100vw * cam) повторена здесь
     один в один, формула заливки осталась в CSS. */
  var layer = document.querySelector('.hero__layer--near');
  var roadDone = document.querySelector('.hero__road-done');
  if (!layer || !roadDone) return;

  /* -- Фоллбэк: вертикальный список -------------------------------------
     Два условия из docs/mobile-spec.md §6: prefers-reduced-motion и
     ширина меньше 340px. Раскладку делает CSS (§5.2), здесь остаётся
     единственное, чего CSS не может: картинки станций лежат в
     .hero__layer--near, а нужны внутри текстовых блоков — «шесть станций
     выводятся обычным вертикальным списком с иллюстрацией и текстом».

     Условие проверяется один раз при инициализации, как и раньше для
     reduced-motion: обратный переход из статического списка в
     закреплённую сцену потребовал бы поднимать весь движок на лету, а
     пересечь 340px без перезагрузки можно разве что поворотом очень
     узкого устройства. */
  var FALLBACK = window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 339.98px)');

  if (FALLBACK.matches) {
    var arts = document.querySelectorAll('.hero__station .hero__station-art');
    for (var a = 0; a < acts.length && a < arts.length; a++) {
      acts[a].insertBefore(arts[a], acts[a].firstChild);
    }
    return;
  }

  /* -- Высота закреплённой сцены ----------------------------------------
     CSS задаёт .hero__pin высоту 100svh; здесь она замеряется и
     фиксируется в пикселях переменной --hero-pin-h. От неё же считается
     длина дорожки (.hero высотой 7.5 * --hero-pin-h), поэтому обе
     величины всегда согласованы.

     Пересчёт — только на load и при смене ориентации, но не на каждый
     resize: на мобильных появление и скрытие адресной строки шлёт resize
     с той же шириной, и пересчёт на нём сдвигал бы сцену прямо во время
     прокрутки (ровно то, от чего в §6 требуется svh вместо dvh).
     Обнуление style перед замером обязательно: иначе на втором вызове
     измерялось бы уже подставленное значение, а не текущий 100svh. */
  /* Пин фиксируется по пикселям на всём, что ниже десктопа: CSS-раскладка
     хиро меняется на 1024px (styles.css §5.1), и обе границы обязаны
     совпадать — иначе планшет считает дорожку от одной высоты, а рисует
     раскладку от другой. */
  var MOBILE = window.matchMedia('(max-width: 1023.98px)');
  /* Плотность заливки — отдельная граница: сплошная «бумага» нужна только
     там, где вступление лежит во всю ширину, то есть на телефоне. */
  var PHONE = window.matchMedia('(max-width: 767.98px)');

  function fixPinHeight() {
    if (!MOBILE.matches) {
      track.style.removeProperty('--hero-pin-h');
      return;
    }
    track.style.removeProperty('--hero-pin-h');
    var h = Math.round(pin.getBoundingClientRect().height);
    if (h > 0) {
      track.style.setProperty('--hero-pin-h', h + 'px');
    }
  }

  function remeasure() {
    fixPinHeight();
    if (window.corexScrollEngine && window.corexScrollEngine.remeasure) {
      window.corexScrollEngine.remeasure();
    }
  }

  fixPinHeight();
  window.addEventListener('load', remeasure);
  window.addEventListener('orientationchange', function () {
    /* Размеры после поворота приходят не сразу — читаем в следующем кадре. */
    requestAnimationFrame(remeasure);
  });
  if (MOBILE.addEventListener) {
    MOBILE.addEventListener('change', remeasure);
  }

  var LABELS = ['заявка', 'цены с фабрики', 'предварительный расчёт', 'проработка', 'договор', 'склад'];
  var N = 6;
  var lastIdx = -1;
  var lastClickable = null;

  /* -- Тайминги состояния ----------------------------------------------
     Всё ниже считается от `local` — прогресса 0..1 внутри одного состояния.
     Вход растянут на треть отрезка, выход короткий и вплотную к границе:
     текст должен жить ровно столько же, сколько едет фон, иначе сцена
     читается как смена слайдов.

     Сдвиг между номером, заголовком и абзацем задан в миллисекундах, а не
     в долях отрезка: сцена scroll-driven, собственного времени у неё нет,
     поэтому 60ms переводятся в local через номинальный вес входа — во
     сколько отрезок входа обходится на обычной скорости прокрутки.
     -------------------------------------------------------------------- */
  var LERP = 0.075;                 /* инерция камеры; поправка на dt — в scroll-engine */
  var ACT_IN = 0.08;                /* local: начало входа состояния */
  var ACT_IN_END = 0.44;            /* local: конец входа */
  var ACT_OUT = 0.84;               /* local: начало выхода */
  var ACT_OUT_END = 1;              /* local: конец выхода */
  var ENTRY_SPAN = ACT_IN_END - ACT_IN;
  var ENTRY_NOMINAL_MS = 600;       /* во сколько обходится отрезок входа на обычной скорости */
  var STAGGER = ENTRY_SPAN * (60 / ENTRY_NOMINAL_MS);  /* 60ms между строками */
  var PART_SPAN = ENTRY_SPAN - 2 * STAGGER;            /* сдвиг укладывается внутрь входа */
  var ENTRY_Y = 24;                 /* подъём строки на входе, px */
  var EXIT_Y = 22;                  /* увод блока на выходе, px */
  var LAG_Y = 12;                   /* собственный снос текста за отрезок, px (не больше) */
  var NODE_LEAD = 0.045;            /* ≈ 40ms при шаге камеры ~0.9s на станцию */

  /* Плотность «бумажной» заливки поверх сцены на вступлении. На десктопе
     вступление занимает левую половину кадра, и сцена справа должна
     просвечивать — 0.5. На телефоне вступление лежит во всю ширину, и
     та же полупрозрачная сцена оказывалась прямо под абзацем: чертёж
     читался сквозь текст (docs/mobile-spec.md §9, «текст не перекрывает
     иллюстрацию»). Поэтому на телефоне заливка почти сплошная — сцена
     открывается со следующим экраном, когда текста вступления уже нет. */
  var WASH_MAX = PHONE.matches ? 0.94 : 0.5;
  if (PHONE.addEventListener) {
    PHONE.addEventListener('change', function () {
      WASH_MAX = PHONE.matches ? 0.94 : 0.5;
    });
  }

  /* Строки состояния в порядке входа: номер → заголовок → абзац. */
  var parts = acts.map(function (act) {
    return [
      act.querySelector('.hero__act-num'),
      act.querySelector('.hero__act-title'),
      act.querySelector('.hero__act-text')
    ].filter(Boolean);
  });

  function clamp(v, a, b) {
    a = a || 0;
    b = b === undefined ? 1 : b;
    return v < a ? a : v > b ? b : v;
  }

  function easeOutExpo(t) {
    return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /* Те же кривые, что и в CSS (docs/motion-spec.md): сцена драйвится
     скроллом, transition здесь не работает, поэтому cubic-bezier считается
     вручную (Ньютон по x, шесть итераций — точнее половины пикселя). */
  function bezier(x1, y1, x2, y2) {
    function at(t, a1, a2) {
      return ((1 - 3 * a2 + 3 * a1) * t + (3 * a2 - 6 * a1)) * t * t + 3 * a1 * t;
    }
    function slope(t, a1, a2) {
      return 3 * (1 - 3 * a2 + 3 * a1) * t * t + 2 * (3 * a2 - 6 * a1) * t + 3 * a1;
    }
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      var t = x;
      for (var i = 0; i < 6; i++) {
        var d = slope(t, x1, x2);
        if (d === 0) break;
        t -= (at(t, x1, x2) - x) / d;
      }
      return at(t, y1, y2);
    };
  }

  var eOut = bezier(0.16, 1, 0.3, 1);      /* --e-out:   вход */
  var eInOut = bezier(0.65, 0, 0.35, 1);   /* --e-inout: выход, решительнее входа */

  /* Дробные позиции дают подрагивание текста от кадра к кадру: всё, что
     уезжает в transform в пикселях, квантуется до 0.5px. */
  function snap(px) {
    return Math.round(px * 2) / 2;
  }

  /* У слоёв позиция задана не в пикселях, а формулой -100vw * --hero-cam,
     поэтому к 0.5px округляется сама камера — по ближнему слою (множитель 1),
     где и стоят волосяные линии реквизита. Ширина читается вне кадра. */
  var viewW = window.innerWidth || 1;
  window.addEventListener('resize', function () {
    viewW = window.innerWidth || 1;
  }, { passive: true });

  function snapCam(cam) {
    return Math.round(cam * viewW * 2) / 2 / viewW;
  }

  function render(p) {
    var out = easeOutExpo(clamp((p - 0.06) / 0.07));
    intro.style.opacity = 1 - out;
    intro.style.transform = 'translateY(var(--hero-base-y)) translateY(' + snap(-60 * out) + 'px) scale(' + (1 - 0.03 * out) + ')';
    var clickable = out <= 0.5;
    if (clickable !== lastClickable) {
      lastClickable = clickable;
      intro.style.pointerEvents = clickable ? 'auto' : 'none';
    }
    wash.style.opacity = (WASH_MAX * (1 - out)).toFixed(3);
    hint.style.opacity = (1 - clamp(p / 0.05)).toFixed(3);

    var q = clamp((p - 0.13) / 0.87);
    var idx = Math.min(N - 1, Math.floor(q * N));
    var local = clamp(q * N - idx);
    var cam = snapCam(Math.min(N - 1, idx + easeInOut(clamp((local - 0.34) / 0.66))));
    layer.style.transform = 'translate3d(' + (-viewW * cam).toFixed(2) + 'px, 0, 0)';
    roadDone.style.setProperty('--hero-cam', cam.toFixed(6));

    for (var i = 0; i < N; i++) {
      var o = 0;
      var y = ENTRY_Y;
      if (i === idx) {
        /* Выход — на всём блоке сразу и по --e-inout: уходит решительнее,
           чем появляется. Последнее состояние не уходит вовсе. */
        var exit = i === N - 1 ? 0 : eInOut(clamp((local - ACT_OUT) / (ACT_OUT_END - ACT_OUT)));
        o = 1 - exit;
        /* Собственный снос текста: ровно LAG_Y за отрезок, симметрично
           относительно середины, чтобы ни вход, ни выход не получили
           видимого смещения. Текст едет медленнее камеры. */
        y = LAG_Y * (local - 0.5) - EXIT_Y * exit;

        var group = parts[i];
        for (var j = 0; j < group.length; j++) {
          var e = eOut(clamp((local - ACT_IN - j * STAGGER) / PART_SPAN));
          group[j].style.opacity = e.toFixed(3);
          group[j].style.transform = 'translateY(' + snap(ENTRY_Y * (1 - e)) + 'px)';
        }
      }
      acts[i].style.opacity = o.toFixed(3);
      acts[i].style.transform = 'translateY(var(--hero-base-y)) translateY(' + snap(y) + 'px)';
      /* Узел загорается раньше, чем линия до него дошла — опережение
         читается как отклик прибора, а не как запаздывание. */
      nodes[i].classList.toggle('is-active', cam >= i - NODE_LEAD);
    }

    if (idx !== lastIdx) {
      lastIdx = idx;
      counter.innerHTML = '<b>' + ('0' + (idx + 1)) + '</b> / 06<br>' + LABELS[idx];
    }
    counter.style.opacity = clamp((p - 0.1) / 0.06).toFixed(3);
  }

  function start() {
    window.corexScrollEngine.register({ track: track, render: render, smooth: LERP });
  }

  /* -- Декодирование до старта ------------------------------------------
     Файлы качает <link rel="preload"> из <head>, но загруженный байт ещё
     не растр: декодирование WebP 1200x857 браузер откладывает до первой
     отрисовки. Случись оно на первом проезде — это кадр в 20-40ms ровно
     там, где камера трогается. Поэтому сцена не регистрируется, пока все
     шесть не декодированы: до этого момента хиро и так стоит в своём
     нулевом состоянии (вступление поверх сплошной «бумаги», .hero__act
     в opacity 0), ничего не мигает и не дёргается.

     Ожидание ограничено: если decode() не ответит (битый файл, отказ
     сети), сцена всё равно заводится по таймеру — неживой хиро хуже
     одного лишнего кадра декодирования. */
  var DECODE_CAP = 2500;

  function whenDecoded() {
    var imgs = [].slice.call(document.querySelectorAll('.hero__station-img'));
    if (!imgs.length || !imgs[0].decode) {
      return Promise.resolve();
    }
    var all = Promise.all(imgs.map(function (img) {
      return img.decode().catch(function () {});
    }));
    return Promise.race([
      all,
      new Promise(function (resolve) { setTimeout(resolve, DECODE_CAP); })
    ]);
  }

  if (typeof Promise === 'function') {
    whenDecoded().then(start);
  } else {
    start();
  }
})();
