/*
  COREX — система появления для всех секций ниже Hero
  (docs/motion-spec.md, часть 1 и 3). Не зависит от GSAP — работает,
  даже если CDN с GSAP не загрузился (как js/hero-panorama.js).

  Владеет: базовым механизмом .reveal/.reveal.in (IntersectionObserver,
  threshold .18, unobserve после срабатывания) и построчной нарезкой
  заголовков секций (.section-title, .final-cta__title) под приём
  «выезд из-под обрезки». Ничего не знает про калькулятор, форму заявки
  или конкретные секции ниже — только про сами эти два класса разметки.

  Секционные приёмы (плашки-счётчики, полосы «Сроки», карточки «Что
  возим») остаются в js/animations.js на GSAP — этот файл трогает
  только заголовочные группы и любой элемент с классом .reveal, включая
  строки таблицы «Без нас» (см. CLAUDE.md, п.1).
*/
(function () {
  'use strict';

  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ==========================================================
     Заголовки секций — построчный выезд из-под обрезки.
     Строки определяются по фактической раскладке (offsetTop соседних
     слов), а не зашиты вручную — иначе приём ломается на любой ширине,
     кроме той, под которую его подогнали. Пересчитывается по resize,
     потому что смена ширины вьюпорта меняет разбивку на строки.
     ========================================================== */
  var TITLE_SELECTOR = '.section-title, .final-cta__title';
  var titleEls = Array.prototype.slice.call(document.querySelectorAll(TITLE_SELECTOR));

  function splitTitleLines(el) {
    if (!el.dataset.titleText) {
      el.dataset.titleText = el.textContent;
      el.setAttribute('aria-label', el.dataset.titleText);
    }

    var words = el.dataset.titleText.trim().split(/\s+/);
    var probeMarkup = words
      .map(function (w) {
        return '<span class="split-probe" style="display:inline-block">' + w + '</span>';
      })
      .join(' ');
    el.innerHTML = '<span aria-hidden="true">' + probeMarkup + '</span>';

    var probes = Array.prototype.slice.call(el.querySelectorAll('.split-probe'));
    var lines = [];
    var top = null;
    probes.forEach(function (probe) {
      if (probe.offsetTop !== top) {
        top = probe.offsetTop;
        lines.push([]);
      }
      lines[lines.length - 1].push(probe.textContent);
    });

    var linesMarkup = lines
      .map(function (lineWords, i) {
        return (
          '<span class="section-title__line"><span class="section-title__line-inner" style="--d:' +
          i * 70 +
          'ms">' +
          lineWords.join(' ') +
          '</span></span>'
        );
      })
      .join('');
    el.innerHTML = '<span aria-hidden="true">' + linesMarkup + '</span>';
  }

  if (titleEls.length && !REDUCE) {
    titleEls.forEach(splitTitleLines);

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        titleEls.forEach(splitTitleLines);
      }, 150);
    });
  }

  /* ==========================================================
     .reveal / .reveal.in — включает и заголовочные группы
     (.section-head.reveal, см. css/styles.css §1.1), и любой другой
     элемент с классом .reveal, если он появится.
     ========================================================== */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  if (!revealEls.length) {
    return;
  }

  if (REDUCE || typeof IntersectionObserver !== 'function') {
    revealEls.forEach(function (el) {
      el.classList.add('in');
    });
    return;
  }

  /* will-change ставится на время самого появления и снимается сразу
     после него (docs/motion-spec.md, правило про разовость приёма):
     .reveal анимирует opacity и transform; will-change поднимает элемент
     в свой слой на время перехода, чтобы проявление не перерисовывало
     его каждый кадр. Держать will-change постоянно нельзя — это
     удержанный слой на каждый появившийся элемент страницы, что само по
     себе тормозит скролл. filter из подсказки убран вместе с самим
     blur: он снят с .reveal (css/styles.css §1.1) — просить браузер
     готовить слой под свойство, которое не анимируется, значит платить
     за композитный слой впустую. */
  var REVEAL_MS = 1600; // запас над --duration-reveal + --d; страховка, если transitionend не придёт

  function clearHint(el) {
    el.style.willChange = '';
  }

  function playReveal(el) {
    el.style.willChange = 'opacity, transform';
    el.classList.add('in');

    var timer = setTimeout(function () {
      el.removeEventListener('transitionend', onEnd);
      clearHint(el);
    }, REVEAL_MS);

    function onEnd(event) {
      if (event.target !== el && event.target.parentNode !== el) {
        return;
      }
      clearTimeout(timer);
      el.removeEventListener('transitionend', onEnd);
      clearHint(el);
    }

    el.addEventListener('transitionend', onEnd);
  }

  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          playReveal(entry.target);
          io.unobserve(entry.target);
        }
      });
    },
    /* docs/mobile-spec.md §3: до 900px порог 0.1, а не 0.18. На коротком
       экране высокий блок может не набрать 18% собственной высоты во
       вьюпорте вообще никогда — и тогда он просто не появится. */
    { threshold: window.matchMedia('(max-width: 899.98px)').matches ? 0.1 : 0.18 }
  );
  revealEls.forEach(function (el) {
    io.observe(el);
  });
})();
