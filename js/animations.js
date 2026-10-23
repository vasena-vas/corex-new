/*
  COREX — слой анимации (GSAP 3 + ScrollTrigger) для всех секций,
  КРОМЕ Hero. Владеет: всеми таймлайнами, ScrollTrigger-инстансами,
  scrub-логикой. Выставляет: инициализацию, читающую разметку через
  атрибуты `data-animate` (расставлены тикетом 02, см. interfaces.md →
  «Что построено» → «Тикет 02»). Прячет: сами таймлайны/scrub-логику —
  наружу ничего не отдаёт.

  Hero (js/hero-panorama.js) — отдельный файл на собственном scroll+rAF
  цикле, без GSAP: панорама должна работать, даже если этот файл ниже не
  запустился вовсе (CDN недоступен и т.п.). Этот файл про Hero ничего не
  знает.

  Ничего не импортирует и не знает про js/calculator.js и js/contact-form.js —
  калькулятор (полоса неопределённости + счётчик диапазона) полностью
  вёрстан внутри самого calculator.js, без GSAP.

  Все анимируемые этим файлом элементы видимы по умолчанию в CSS
  (`gsap.from(...)` сам прячет их перед стартом) — прогрессивное улучшение
  без JS/при неудачной загрузке CDN не требует отдельной ветки: секции
  просто остаются в статичном, но полностью читаемом состоянии.
*/

(function () {
  'use strict';

  // Нет GSAP/ScrollTrigger (CDN недоступен, скрипт заблокирован и т.п.) —
  // контент и так виден по умолчанию (см. комментарий выше), просто не
  // будет анимироваться.
  if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') {
    document.documentElement.classList.add('no-anim');
    return;
  }

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);

  /* limitCallbacks: колбэки триггера зовутся только при реальной смене
     состояния, а не на каждом кадре прокрутки.

     Отдельно к этому: десять из двенадцати триггеров ниже — одноразовые
     появления (start: 'top 8x%', без scrub). У них выставлен once: true,
     и ScrollTrigger убивает их сразу после срабатывания. По умолчанию
     (toggleActions 'play none none none') они тоже играли один раз, но
     оставались в списке и пересчитывались на каждом кадре прокрутки до
     конца жизни страницы — а в замере прокрутки скрипты были самой
     дорогой строкой. Видимое поведение не меняется: как играли один раз
     при входе и не отыгрывали назад, так и играют. Scrub-триггеров это
     не касается — они живут всю страницу по определению. */
  ScrollTrigger.config({ limitCallbacks: true });

  /* ==========================================================
     ПЛАШКИ ПОД HERO — ведомость из 4 значений. Авторский акцент: линия
     "прилетает" из-под шва Hero (scaleX), а числовые значения
     («2 дня», «2–3 дня») досчитываются вверх, как будто читаются с
     таймера — небольшая деталь, которая продаёт саму идею «мы уже
     считаем» до того, как посетитель дойдёт до калькулятора.
     ========================================================== */
  function initHeroStats() {
    var section = document.querySelector('.hero-stats');
    var rule = document.querySelector('[data-animate="hero-stats-rule"]');
    var items = gsap.utils.toArray('[data-animate="hero-stat"]');
    if (!section) {
      return;
    }

    var tl = gsap.timeline({ scrollTrigger: { trigger: section, start: 'top 85%', once: true } });

    if (rule) {
      tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: 'power2.out' });
    }
    if (items.length) {
      // Задержка между соседями — 70мс (--stagger-reveal), см. docs/motion-spec.md.
      tl.from(items, { opacity: 0, y: 16, duration: 0.5, ease: 'power2.out', stagger: 0.07 }, rule ? '-=0.25' : 0);
    }

    // Досчитать число из уже отрисованного текста (учитывает правки
    // js/inline-editor.js — он применяется раньше, до этого скрипта).
    items.forEach(function (item) {
      var valueEl = item.querySelector('.hero-stats__value');
      if (!valueEl) {
        return;
      }
      var original = valueEl.textContent;
      var match = original.match(/^(\d+)/);
      if (!match) {
        return;
      }
      var target = parseInt(match[1], 10);
      var rest = original.slice(match[1].length);
      var proxy = { n: 0 };
      /* onUpdate у GSAP приходит раз в кадр, но Math.round на плавной
         кривой почти всегда даёт то же число, что и в прошлом кадре.
         Присваивание textContent тем же значением всё равно сбрасывает
         разметку текста и заставляет пересчитать строку. Поэтому пишем
         только когда цифра действительно сменилась; ширина цифр у
         .hero-stats__value уже зафиксирована tabular-nums, так что
         смена не двигает соседей. */
      var shownN = -1;
      tl.to(
        proxy,
        {
          n: target,
          duration: 0.9, // --duration-stat-count, easeOutExpo — см. docs/motion-spec.md
          ease: 'expo.out',
          onUpdate: function () {
            var v = Math.round(proxy.n);
            if (v === shownN) {
              return;
            }
            shownN = v;
            valueEl.textContent = v + rest;
          },
          onComplete: function () {
            valueEl.textContent = original;
          }
        },
        '-=0.35'
      );
    });
  }

  /* ==========================================================
     СЕКЦИЯ 3 — сроки: настоящая диаграмма. Длина бара пропорциональна
     числу дней (data-days на строке) относительно самого долгого этапа
     своей группы (одна шкала на колонку) — это визуализация реальных
     цифр из копирайта, а не декоративная полоска. Число в строке считается
     синхронно с ростом бара, той же длительностью 1200мс (--duration-
     reveal-line) — оба обязаны опираться на одно и то же число, поэтому
     счётчик берёт значение не из текста строки, а из того же data-days,
     которым уже задана длина бара: иначе полоса "3 дня" и счётчик,
     досчитавший до "2", разъезжались бы.
     ========================================================== */
  function countTimelineValue(el, target, duration) {
    if (!el) {
      return;
    }
    var original = el.textContent;
    // Последнее число в строке — верхняя граница диапазона («2–3 дня» →
    // 3, «22–25 дней» → 25), то самое, что задаёт data-days и длину бара.
    var match = original.match(/(\d+)(\D*)$/);
    if (!match) {
      return; // текст без числа («около месяца») — остаётся статичным
    }
    var prefix = original.slice(0, match.index);
    var suffix = match[2];
    var proxy = { n: 0 };
    /* Та же защита, что и у плашек под Hero: писать textContent только
       на смене цифры, а не каждый кадр. */
    var shownN = -1;
    gsap.to(proxy, {
      n: target,
      duration: duration,
      ease: 'power1.out',
      onUpdate: function () {
        var v = Math.round(proxy.n);
        if (v === shownN) {
          return;
        }
        shownN = v;
        el.textContent = prefix + v + suffix;
      },
      onComplete: function () {
        el.textContent = original;
      }
    });
  }

  // reduceMotion=true: полосы «Сроки» держат scaleX(0) в CSS по умолчанию
  // (transition-старт), а не сам scaleX(1) — фиксированным медиа-запросом
  // его не выразить, потому что ширина у .timelines__bar зависит от
  // data-days на строке. Поэтому при reduced-motion эта функция всё равно
  // вызывается (см. init() ниже), просто gsap.set вместо gsap.fromTo —
  // без анимации, но и без полос нулевой ширины.
  function initTimelines(reduceMotion) {
    var groups = gsap.utils.toArray('[data-animate="timeline-group"]');
    if (!groups.length) {
      return;
    }

    groups.forEach(function (group) {
      var title = group.querySelector('.timelines__group-title');
      var rows = gsap.utils.toArray('.timelines__row', group);
      if (!rows.length) {
        return;
      }

      var days = rows.map(function (row) {
        return parseFloat(row.getAttribute('data-days')) || 1;
      });
      var max = Math.max.apply(null, days);

      if (title && !reduceMotion) {
        gsap.from(title, {
          opacity: 0,
          y: 10,
          duration: 0.35,
          ease: 'power2.out',
          scrollTrigger: { trigger: group, start: 'top 80%', once: true }
        });
      }

      rows.forEach(function (row, i) {
        var bar = row.querySelector('[data-animate="timeline-bar"]');
        var widthScale = Math.max(days[i] / max, 0.05);

        if (!bar) {
          return;
        }

        if (reduceMotion) {
          gsap.set(bar, { scaleX: widthScale });
          return;
        }

        var valueEl = row.querySelector('.timelines__value');
        var delay = 0.15 + i * 0.08; // --stagger-reveal-подобный темп между строками колонки
        gsap.fromTo(
          bar,
          { scaleX: 0 },
          {
            scaleX: widthScale,
            duration: 1.2, // --duration-reveal-line
            ease: 'power3.out',
            delay: delay,
            scrollTrigger: { trigger: group, start: 'top 80%', once: true },
            onStart: function () {
              countTimelineValue(valueEl, days[i], 1.2);
            }
          }
        );
      });
    });

    // Диаграмма-перекрытие «производство/сертификация»: обе дорожки растут
    // от одного и того же триггера, чуть друг за другом — так видно, что
    // это два параллельных отрезка одной шкалы времени, а не последовательность.
    var overlap = document.querySelector('.timelines__overlap');
    var overlapBars = gsap.utils.toArray('[data-animate="timelines-overlap-bar"]');
    if (overlap && overlapBars.length) {
      if (reduceMotion) {
        gsap.set(overlapBars, { scaleX: 1 });
      } else {
        gsap.fromTo(
          overlapBars,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: 0.9,
            ease: 'power3.out',
            stagger: 0.1,
            scrollTrigger: { trigger: overlap, start: 'top 85%', once: true }
          }
        );
      }
    }
  }

  /* ==========================================================
     СЕКЦИЯ 4 — калькулятор: reveal панели (результат — отдельный observer).
     ========================================================== */
  function initCalculatorPanel() {
    var panel = document.querySelector('[data-animate="calculator-panel"]');
    if (!panel) {
      return;
    }
    gsap.from(panel, {
      opacity: 0,
      y: 30,
      scale: 0.97,
      duration: 0.7,
      ease: 'power2.out',
      scrollTrigger: { trigger: panel, start: 'top 78%', once: true }
    });
  }

  /* ==========================================================
     СЕКЦИЯ 5 — кейсы: своей GSAP-анимации не имеет. Шапка, вкладки и
     строка под блоком появляются общим .reveal (js/reveal.js), а
     переключение кейсов ведёт js/cases.js — вручную, без скролла и
     без GSAP (docs/motion-spec.md, «Блок кейсов — переключение»).
     ========================================================== */

  /* ==========================================================
     СЕКЦИЯ 6 — категории (картотека): своей GSAP-анимации не имеет —
     появление списка и панели ведёт общий .reveal (js/reveal.js), а
     подмену содержимого панели по клику — js/categories.js. Тот же
     подход, что у §7 COVERAGE («Без нас»).
     ========================================================== */

  /* ==========================================================
     СЕКЦИЯ 7 — чем это подтверждается: лёгкий reveal страницы.
     ========================================================== */
  function initProof() {
    var items = gsap.utils.toArray('[data-animate="proof-item"]');
    if (!items.length) {
      return;
    }
    gsap.from(items, {
      opacity: 0,
      y: 18,
      duration: 0.5,
      ease: 'power2.out',
      stagger: 0.1,
      scrollTrigger: { trigger: '.proof__list', start: 'top 84%', once: true }
    });
  }

  /* ==========================================================
     СЕКЦИЯ 8 — вопросы: reveal карточек аккордеона. Раскрытие/закрытие
     самого <details> — нативное, JS его не трогает.
     ========================================================== */
  function initFaq() {
    var items = gsap.utils.toArray('[data-animate="faq-item"]');
    if (!items.length) {
      return;
    }
    gsap.from(items, {
      opacity: 0,
      y: 16,
      duration: 0.45,
      ease: 'power2.out',
      // Вопросов девять, а очередь появления — не больше шести элементов
      // с задержкой (иначе последний ждёт почти полсекунды): с седьмого
      // элементы группируются на задержке шестого, а не продолжают копить её.
      stagger: function (i) {
        return Math.min(i, 5) * 0.06;
      },
      scrollTrigger: { trigger: '.faq__list', start: 'top 84%', once: true }
    });
  }

  /* ==========================================================
     СЕКЦИЯ 9 — заявка: параллакс вуали, переход, reveal формы/контактов.
     ========================================================== */
  function initFinalCta() {
    var section = document.querySelector('.final-cta');
    var veil = document.querySelector('[data-animate="final-veil"]');
    var seam = document.querySelector('[data-animate="transition-final-in"]');
    var panel = document.querySelector('[data-animate="final-panel"]');
    var contacts = document.querySelector('[data-animate="final-contacts"]');
    var contactRows = contacts ? gsap.utils.toArray('.final-cta__contact', contacts) : [];

    if (veil) {
      gsap.fromTo(
        veil,
        { yPercent: -6 },
        {
          yPercent: 6,
          ease: 'none',
          scrollTrigger: { trigger: section || veil, start: 'top bottom', end: 'bottom top', scrub: 0.8 }
        }
      );
    }

    if (seam) {
      gsap.set(seam, { opacity: 0 });
      gsap.to(seam, {
        opacity: 1,
        ease: 'none',
        scrollTrigger: { trigger: section || seam, start: 'top bottom', end: 'top 45%', scrub: 0.6 }
      });
    }

    if (panel) {
      gsap.from(panel, {
        opacity: 0,
        y: 36,
        scale: 0.97,
        duration: 0.7,
        ease: 'power2.out',
        scrollTrigger: { trigger: panel, start: 'top 82%', once: true }
      });
    }

    if (contactRows.length) {
      gsap.from(contactRows, {
        opacity: 0,
        x: -16,
        duration: 0.5,
        ease: 'power2.out',
        stagger: 0.1,
        scrollTrigger: { trigger: contacts, start: 'top 85%', once: true }
      });
    } else if (contacts) {
      gsap.from(contacts, {
        opacity: 0,
        y: 20,
        duration: 0.6,
        ease: 'power2.out',
        scrollTrigger: { trigger: contacts, start: 'top 85%', once: true }
      });
    }
  }

  /* ==========================================================
     Reduced motion — весь scrub/pin и декоративное движение отключены,
     контент виден в конечном состоянии сразу. Почти для всех секций
     ниже этого достаточно: их gsap.from(...)/scrub-таймлайны просто не
     запускаются в этой ветке matchMedia, а элементы остаются в своём
     обычном (видимом) CSS-состоянии — оно у них opacity:1 по умолчанию,
     GSAP прячет их только в момент запуска анимации.

     Исключение — .timelines__bar/.timelines__overlap-bar: их скрытое
     состояние (scaleX(0)) прописано в CSS-дефолте, а не выставляется
     GSAP на лету, поэтому простой пропуск initTimelines оставил бы
     полосы «Сроки» нулевой ширины навсегда. initTimelines поэтому
     вызывается и здесь — с reduceMotion=true она сама выставляет
     конечную ширину без анимации (см. функцию выше).

     Hero (js/hero-panorama.js) не завязан на GSAP и сам проверяет
     `prefers-reduced-motion` независимо от этого файла.
     ========================================================== */
  function init() {
    var mm = gsap.matchMedia();

    mm.add(
      {
        // Ключ "all" — служебный для gsap.matchMedia: без него колбэк не
        // срабатывает при первой загрузке, если `reduceMotion` не совпадает
        // (обычный десктоп без reduced-motion) — matchMedia считает
        // "ничего не совпало" и не вызывает функцию вообще.
        all: '',
        reduceMotion: '(prefers-reduced-motion: reduce)'
      },
      function (context) {
        var conditions = context.conditions || {};

        if (conditions.reduceMotion) {
          initTimelines(true);
          return;
        }

        initHeroStats();
        initTimelines();
        initCalculatorPanel();
        initProof();
        initFaq();
        initFinalCta();
      }
    );

    window.addEventListener('load', function () {
      ScrollTrigger.refresh();
    });
  }

  init();
})();
