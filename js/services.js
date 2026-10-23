/*
  COREX — блок «Услуги»: связь карточек с формой заявки.

  Владеет: поведением кнопок [data-product] внутри секции #services.
  Выставляет: ничего наружу. Прячет: то, каким полем формы задаётся услуга.

  Про содержимое формы знает ровно одно — id поля «Что нужно»
  (#contact-need). Валидацию и отправку по-прежнему ведёт
  js/contact-form.js, этот файл её не трогает и не дублирует.

  ПОЧЕМУ ОБРАБОТЧИК ВЕШАЕТСЯ НА САМИ КНОПКИ, А НЕ НА ДОКУМЕНТ:
  в js/scroll-engine.js уже есть делегированный обработчик кликов по
  внутренним якорям (он заменил снятый scroll-behavior: smooth). Слушатель
  на самой кнопке срабатывает раньше документного, и после его
  preventDefault делегированный обработчик пропускает клик — иначе
  страницу везли бы к якорю дважды, двумя разными вызовами scrollTo.

  Без JS кнопки остаются обычными ссылками на #contacts: услуга не
  подставится, но до формы человек дойдёт.
*/
(function () {
  'use strict';

  var GOAL = 'calc_click';
  var FLASH_MS = 360;      // = --duration-toggle, столько же длится штатное подчёркивание поля
  var SCROLL_TIMEOUT = 1600; // страховка, если событие scrollend не придёт
  var MAX_SCROLL_PASSES = 2; // основной проезд + одна доводка
  var GAP = 24;              // воздух между низом шапки и верхом формы

  var section = document.getElementById('services');
  var form = document.getElementById('contact-form');
  var need = document.getElementById('contact-need');
  if (!section || !form || !need) {
    return;
  }

  var buttons = [].slice.call(section.querySelectorAll('[data-product]'));
  if (!buttons.length) {
    return;
  }

  var header = document.querySelector('.site-header');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ==========================================================
     Яндекс Метрика. На момент написания счётчик на страницу не
     подключён (в index.html нет ни mc.yandex.ru, ни window.ym), поэтому
     код ниже просто молчит. Когда счётчик поставят, цель начнёт уходить
     сама — id читается из самой Метрики, дублировать его в коде не нужно.
     ========================================================== */
  function metrikaCounters() {
    var ids = [];
    var i;

    var registry = window.Ya && window.Ya._metrika && window.Ya._metrika.counters;
    if (registry) {
      for (i in registry) {
        if (Object.prototype.hasOwnProperty.call(registry, i) && registry[i] && registry[i].id) {
          ids.push(registry[i].id);
        }
      }
    }

    // Счётчик ещё грузится — id лежит в очереди вызовов заглушки ym.a.
    if (!ids.length && typeof window.ym === 'function' && window.ym.a) {
      for (i = 0; i < window.ym.a.length; i++) {
        if (window.ym.a[i] && window.ym.a[i][1] === 'init' && ids.indexOf(window.ym.a[i][0]) === -1) {
          ids.push(window.ym.a[i][0]);
        }
      }
    }

    return ids;
  }

  function reachGoal(product) {
    if (typeof window.ym !== 'function') {
      return;
    }
    try {
      metrikaCounters().forEach(function (id) {
        window.ym(id, 'reachGoal', GOAL, { product: product });
      });
    } catch (err) {
      /* Аналитика не должна ломать переход к форме. */
    }
  }

  /* ==========================================================
     Подчёркивание поля «Что нужно» — тем же приёмом, что и фокус поля
     формы (css/styles.css, .form-field input/select/textarea):
     background-size 0%→100% при background-position: center bottom, то
     есть линия растёт от центра к обоим краям. Отдельной анимации не
     заводим — это ровно то движение, которое у поля уже есть.
     ========================================================== */
  var flashTimer;

  function flashNeed() {
    window.clearTimeout(flashTimer);
    need.classList.remove('is-marked');
    // Перезапуск перехода: без принудительного пересчёта повторный клик по
    // той же услуге не проигрывает линию заново.
    void need.offsetWidth;
    need.classList.add('is-marked');
    flashTimer = window.setTimeout(function () {
      need.classList.remove('is-marked');
    }, FLASH_MS);
  }

  /* ==========================================================
     Прокрутка к форме и фокус после неё.
     ========================================================== */
  function focusFirstEmpty() {
    var candidates = [].slice.call(form.querySelectorAll('input, select, textarea'));
    for (var i = 0; i < candidates.length; i++) {
      if (!String(candidates[i].value || '').trim()) {
        // preventScroll: иначе браузер довезёт поле до своего края вьюпорта
        // и отменит только что проигранную прокрутку.
        candidates[i].focus({ preventScroll: true });
        return;
      }
    }
  }

  function formTarget() {
    var headerH = header ? header.getBoundingClientRect().height : 0;
    var top = form.getBoundingClientRect().top + (window.pageYOffset || 0) - headerH - GAP;
    return top < 0 ? 0 : top;
  }

  /*
    Прокрутка с доводкой.

    Одного scrollTo мало: цель считается в момент клика, а по дороге форма
    успевает сдвинуться. Панель заявки до своего появления держит
    GSAP-состояние `y: 36, scale: .97` (js/animations.js, initFinalCta), и
    getBoundingClientRect в этот момент отдаёт положение на 48px ниже
    итогового — приехав, страница показывала форму заехавшей под шапку.
    Поэтому после остановки цель пересчитывается, и если промах больше
    пары пикселей — делается короткая доводка. Двух попыток хватает с
    запасом: сдвиг даёт разовая анимация появления, второй раз она уже не
    играет. Счётчик всё равно нужен, чтобы никакая будущая анимация не
    смогла загнать страницу в бесконечную догонялку.
  */
  function scrollToForm(done, attempt) {
    attempt = attempt || 0;
    var smooth = !reduce.matches;
    var target = formTarget();

    var finished = false;
    function settled() {
      if (finished) {
        return;
      }
      finished = true;
      window.removeEventListener('scrollend', settled);
      window.clearTimeout(timer);

      var drift = Math.abs(formTarget() - (window.pageYOffset || 0));
      if (drift > 2 && attempt < MAX_SCROLL_PASSES - 1) {
        scrollToForm(done, attempt + 1);
        return;
      }
      done();
    }

    var timer = window.setTimeout(settled, SCROLL_TIMEOUT);
    if ('onscrollend' in window) {
      window.addEventListener('scrollend', settled);
    }

    window.scrollTo({ top: target, behavior: smooth ? 'smooth' : 'auto' });

    if (!smooth) {
      settled();
    }
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function (event) {
      var product = btn.getAttribute('data-product');
      if (!product) {
        return;
      }

      event.preventDefault();

      // Выставляем услугу по value. Если варианта в списке нет — оставляем
      // поле как есть и не делаем вид, что выбор произошёл.
      var matched = false;
      for (var i = 0; i < need.options.length; i++) {
        if (need.options[i].value === product) {
          need.selectedIndex = i;
          matched = true;
          break;
        }
      }
      if (matched) {
        // change — для любого кода, который однажды подпишется на поле;
        // сам js/contact-form.js читает значение только при сабмите.
        need.dispatchEvent(new Event('change', { bubbles: true }));
      }

      reachGoal(product);

      scrollToForm(function () {
        if (matched) {
          flashNeed();
        }
        focusFirstEmpty();
      });
    });
  });
})();
