/*
  COREX — блок «Что возим»: картотека категорий (секция 6).
  Владеет: переключением категории в #cvCats/#cvPanel и подменой
  содержимого панели по данным CATS. Имена категорий остаются в разметке
  (редактируются через data-edit-id, см. js/inline-editor.js) — сюда
  вынесены только четыре поля картотеки на категорию, чтобы не размазывать
  контент по HTML (CLAUDE.md, «Перенос блоков из docs/ref-*.html»).

  Разовое появление блока при скролле ведёт общий .reveal (js/reveal.js) —
  этот файл трогает только is-in/is-out на .cv-panel при клике по категории
  и ничего не знает про animations.js/calculator.js.
*/
(function () {
  'use strict';

  var cats = document.getElementById('cvCats');
  var panel = document.getElementById('cvPanel');

  if (!cats || !panel) {
    return;
  }

  var buttons = Array.prototype.slice.call(cats.querySelectorAll('.cv-cat'));
  if (!buttons.length) {
    return;
  }

  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var OUT_MS = REDUCE ? 0 : 200;

  var CATS = [
    {
      docs: 'Чаще всего <span class="cv-hi">декларация ТР ТС 010/2011</span> — безопасность машин и оборудования.',
      docsNote: 'На отдельные позиции вместо декларации нужен сертификат. Определяем до отгрузки.',
      ship: 'Авто или железная дорога. Негабарит — море.',
      watch: 'Габариты и вес одного места: от них зависит, пойдёт груз штатно или как негабаритный.',
      seen: 'Гидравлические прессы, алмазные пилы по бетону, станки'
    },
    {
      docs: 'Обычно <span class="cv-hi">ТР ТС 010</span> плюс <span class="cv-hi">ТР ТС 020</span> по электромагнитной совместимости.',
      docsNote: 'Если есть силовая часть на 220 В — добавляется ТР ТС 004 по низковольтному оборудованию.',
      ship: 'Авиа или авто — товар дорогой, простой обходится дороже фрахта.',
      watch: 'Комплектность поставки и напряжение питания. Часть комплекта фабрики отгружают отдельно.',
      seen: 'Манипуляторы, линии автоматической подачи, контроллеры'
    },
    {
      docs: '<span class="cv-hi">ТР ТС 020</span> и <span class="cv-hi">ТР ТС 004</span>. На компоненты без самостоятельной функции обычно достаточно отказного письма.',
      docsNote: 'Если внутри есть радиомодуль или шифрование — отдельно нужна нотификация ФСБ. Её проще получить до отгрузки, чем объясняться на границе.',
      ship: 'Авиа. Вес небольшой, срок 4–7 дней.',
      watch: 'Есть ли беспроводной модуль. Это первое, что выясняем: от ответа зависит и срок, и пакет документов.',
      seen: 'Платы управления, датчики, силовые модули'
    },
    {
      docs: 'Чаще всего <span class="cv-hi">сертификация не требуется</span> — оформляем отказное письмо.',
      docsNote: 'Запчасть без самостоятельной функции под технические регламенты не подпадает. Но это надо подтвердить документом, а не словами.',
      ship: 'Авто. При срочном ремонте — авиа.',
      watch: 'Код ТН ВЭД и привязка к конкретной модели оборудования. Ошибка в коде — самая частая причина переплаты по пошлине.',
      seen: 'Шлюзовые питатели, мотор-редукторы, узлы к линиям'
    },
    {
      docs: '<span class="cv-hi">ТР ТС 010</span>. Для подъёмной техники список расширяется.',
      docsNote: 'Бывшее в употреблении оформляется иначе, чем новое: нужно подтвердить год выпуска и состояние.',
      ship: 'Море или железная дорога — объёмный груз, срок 25–30 дней.',
      watch: 'Новое или б/у. От этого зависит и пакет документов, и таможенная стоимость.',
      seen: 'Упаковочные линии, конвейеры, стеллажные системы'
    },
    {
      docs: 'Зависит от товара: <span class="cv-hi">ТР ТС 007, 017, 005</span> — детские товары, лёгкая промышленность, упаковка.',
      docsNote: 'Отдельно проверяем, попадает ли товар под обязательную маркировку «Честный знак»: это влияет и на срок, и на то, что нужно согласовать с фабрикой заранее.',
      ship: 'Авто или железная дорога.',
      watch: 'Маркировка и упаковка. Их согласуем с фабрикой до производства, чтобы не переупаковывать партию в России.',
      seen: 'Товарные партии под собственный бренд'
    }
  ];

  var active = -1;
  var busy = false;

  function markup(c, i) {
    return (
      '<div class="cv-panel-top">' +
        '<div class="cv-panel-lbl cv-anim" style="--d:0ms">Что обычно требуется</div>' +
        '<div class="cv-panel-idx cv-anim" style="--d:0ms"><b>0' + (i + 1) + '</b> / 0' + CATS.length + '</div>' +
      '</div>' +
      '<dl class="cv-rows">' +
        '<div class="cv-row cv-anim" style="--d:70ms"><dt>Документы</dt><dd>' + c.docs + '<small>' + c.docsNote + '</small></dd></div>' +
        '<div class="cv-row cv-anim" style="--d:140ms"><dt>Доставка</dt><dd>' + c.ship + '</dd></div>' +
        '<div class="cv-row cv-anim" style="--d:210ms"><dt>На что смотрим первым делом</dt><dd>' + c.watch + '</dd></div>' +
        '<div class="cv-row cv-anim" style="--d:280ms"><dt>Уже возили</dt><dd>' + c.seen + '</dd></div>' +
      '</dl>'
    );
  }

  /* Активная вкладка подтягивается в видимую часть ленты
     (docs/mobile-spec.md §7). Нужно только на телефоне: с 768px вкладки
     стоят колонкой и прокручивать нечего — там scrollWidth равен
     clientWidth, и условие ниже само отсекает лишнюю работу.

     Стрелками с клавиатуры активная вкладка тоже меняется, так что это
     ещё и починка фокуса, уехавшего за край ленты. */
  function scrollTabIntoView(btn) {
    if (!btn || cats.scrollWidth <= cats.clientWidth + 1) {
      return;
    }
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var left = btn.offsetLeft - (cats.clientWidth - btn.offsetWidth) / 2;
    cats.scrollTo({
      left: Math.max(0, left),
      behavior: reduce ? 'auto' : 'smooth'
    });
  }

  function paint(i) {
    panel.classList.remove('is-out');
    panel.innerHTML = markup(CATS[i], i);
    void panel.offsetWidth;
    panel.classList.add('is-in');
    busy = false;
  }

  function select(i) {
    if (i === active || busy) {
      return;
    }
    var first = active === -1;
    active = i;

    buttons.forEach(function (b, j) {
      b.classList.toggle('is-active', j === i);
      b.setAttribute('aria-selected', j === i ? 'true' : 'false');
    });

    scrollTabIntoView(buttons[i]);

    if (first) {
      paint(i);
      return;
    }

    busy = true;
    panel.classList.remove('is-in');
    panel.classList.add('is-out');
    setTimeout(function () {
      paint(i);
    }, OUT_MS);
  }

  buttons.forEach(function (b, i) {
    b.addEventListener('click', function () {
      select(i);
    });
    b.addEventListener('keydown', function (e) {
      var next;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        next = (i + 1) % buttons.length;
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        next = (i - 1 + buttons.length) % buttons.length;
      } else {
        return;
      }
      e.preventDefault();
      buttons[next].focus();
      select(next);
    });
  });

  select(0);
})();
