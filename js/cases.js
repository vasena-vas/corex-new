/**
 * COREX — секция 5, кейсы.
 *
 * Тексты: docs/cases.md — единственный источник. Движение:
 * docs/motion-spec.md, раздел «Блок кейсов — переключение», плюс токены и
 * восемь запретов оттуда же. Скролл-анимации в блоке нет вовсе: кейсы
 * переключает сам посетитель (клик по вкладке, стрелки ← →, свайп),
 * автопрокрутки нет.
 *
 * Все данные — в массиве CASES ниже. Новый кейс добавляется одной записью:
 * вкладки, карточки, «NN / NN», счётчик и полоса прогресса собираются
 * отсюда, в index.html правок не требуется.
 *
 * Переход асимметричный: старая карточка уходит за 200мс целиком
 * (opacity/translateX/blur на самой карточке), и только после этого новая
 * входит шестью элементами по очереди (номер, заголовок, было, что сделали,
 * цифры, фото) — 700мс на --e-out со stagger 70мс. Само движение живёт в
 * CSS (css/styles.css §10), здесь только классы, направление (--sx/--ox) и
 * порядок. Новый клик прерывает текущий переход: все отложенные шаги и
 * счётчики снимаются, карточка вне пары «уходящая/входящая» гасится сразу,
 * анимации не копятся.
 *
 * Мобильный (< 900px): вкладок нет, карточки лежат в ленте со scroll-snap и
 * показаны все сразу в конечном состоянии — переход там делает сам скролл.
 * Листание — нативное: свои обработчики touch на этой ширине не висят вовсе
 * (applyLane их снимает). Скрипт ведёт счётчик «1 / 3» и полосу прогресса:
 * полоса идёт вместе с лентой, --p считается из scrollLeft на каждом кадре.
 * Цифры результата досчитываются при первом показе карточки — по въезду
 * блока в экран (IntersectionObserver, порог 0.1 из docs/mobile-spec.md §3)
 * и дальше по мере того, как карточка становится текущей. Режим
 * переключается по matchMedia, а не по разовому замеру ширины.
 *
 * prefers-reduced-motion: смена кейса мгновенная, числа сразу в конечном
 * значении (запрет №8 — конечное состояние, а не отключённая страница).
 *
 * Фото: пути ведут в assets/cases/. Снимки 01–03 сняты ровно 4:3; файлы case04–case06
 * добавлены позже. Если у кейса photos пустой, ряд с фото не выводится. У записи фото есть три необязательных поля: focus
 * (object-position, главный объект в кадре при обрезке), tone (класс правки
 * яркости на конкретном снимке) и sheet (кадр — не снимок, а чертёж на белом
 * листе: contain вместо cover, светлая подложка, рамка и тёмная подпись).
 * Все три разбираются в css/styles.css §10.2.
 */
(function () {
  'use strict';

  /* ==========================================================
     Данные. Порядок записей = порядок кейсов на странице.
     Формулировки перенесены из docs/cases.md дословно.
     ========================================================== */
  var CASES = [
    {
      tab: 'Световые вывески',
      tabMetric: '7 000+ шт',
      title: '7 000 вывесок с двух фабрик за 7 недель',
      before: 'Заказчику нужна крупная партия световых вывесок для сети пунктов выдачи: неоновые, LED-вывески и лайтбоксы с графиком работы. Две фабрики в Гуанчжоу, товар подлежит обязательной сертификации.',
      done: [
        'Привезли образцы с обеих фабрик и оформили декларации соответствия до прихода партии',
        'Рассчитали раскладку коробов в фурах, чтобы вывески длиной 2,4 м доехали без повреждений',
        'Сопроводили каждый платёж в рамках валютного контроля и закрыли поставку семью фурами'
      ],
      metrics: [
        { value: '7 000+', label: 'вывесок' },
        { value: '7 фур', label: 'за 7 недель' },
        { value: '2 фабрики', label: 'в одной поставке' }
      ],
      photos: [
        { src: 'assets/cases/01_vyveski_ceh-proizvodstvo.jpg', caption: 'Цех производства' },
        { src: 'assets/cases/02_vyveski_gotovye-bukvy.jpg', caption: 'Готовые буквы' },
        { src: 'assets/cases/03_vyveski_proverka-svecheniya.jpg', caption: 'Проверка свечения' },
        { src: 'assets/cases/04_vyveski_pogruzka.jpg', caption: 'Погрузка' }
      ]
    },
    {
      tab: 'Гидравлический пресс',
      tabMetric: '−700 000 ₽',
      title: 'На 700 000 ₽ дешевле и на 10 дней быстрее',
      before: 'Предложение на поставку гидравлического пресса и пресс-формы под ключ: 4,6 млн ₽ и 100 дней.',
      done: [
        'Провели тестовые испытания пресса на фабрике до отгрузки',
        'Составили контракт с защитой интересов заказчика',
        'Заранее рассчитали таможенные платежи, получили сертификацию и довезли груз до заказчика'
      ],
      metrics: [
        { value: '700 000 ₽', label: 'экономии, −15%' },
        { value: '90 дней', label: 'вместо 100' },
        { value: '3,9 млн ₽', label: 'итоговая стоимость' }
      ],
      photos: [
        { src: 'assets/cases/01-main.jpg', caption: 'Гидравлический пресс' },
        { src: 'assets/cases/01-second.jpg', caption: 'Пресс на фабрике', focus: '50% 30%' }
      ]
    },
    {
      tab: 'Станок с алмазной пилой',
      tabMetric: '−500 000 ₽',
      title: 'Та же поставка под ключ на 500 000 ₽ дешевле',
      before: 'Клиенту уже предложили поставить станок с алмазной пилой под ключ за 2,2 млн ₽.',
      done: [
        'Взяли на себя переговоры с заводом, контракт, сертификаты и таможню',
        'Добились, чтобы производитель перевёл программное обеспечение станка на русский',
        'Перевели инструкции к оборудованию'
      ],
      metrics: [
        { value: '500 000 ₽', label: 'экономии, −23%' },
        { value: '1,7 млн ₽', label: 'вместо 2,2 млн' },
        { value: '90 дней', label: 'под ключ' }
      ],
      photos: [
        { src: 'assets/cases/02-main.jpg', caption: 'Станок с алмазной пилой' },
        { src: 'assets/cases/02-second.jpg', caption: 'Станок на фабрике' }
      ]
    },
    {
      tab: 'Шлюзовые дозаторы',
      tabMetric: '30 фабрик',
      title: 'Нестандартный узел по чертежу — и повторный заказ на 21 штуку',
      before: 'Нужен шлюзовой дозатор под индивидуальные размеры по техническому заданию. У российских производителей — дороже.',
      done: [
        'Сравнили 30 производителей и выбрали того, кто делает под это ТЗ',
        'Контролировали производство и согласовали с фабрикой правки параметров по ходу работы',
        'Довезли первую партию, после чего заказчик вернулся за 21 дозатором — для неё добились рассрочки 12 месяцев вместо 6'
      ],
      metrics: [
        { value: '30 фабрик', label: 'в сравнении' },
        { value: '200 000 ₽', label: 'дешевле, чем в России' },
        { value: '21 шт', label: 'повторный заказ' }
      ],
      photos: [
        { src: 'assets/cases/03-main.jpg', caption: 'Шлюзовой дозатор по ТЗ' },
        { src: 'assets/cases/03-second.jpg', caption: 'Изготовление на фабрике' },
        { src: 'assets/cases/case04_dozatory_gotovy-k-otgruzke.jpg', caption: 'Готовы к отгрузке на фабрике' }
      ]
    },
    {
      tab: 'Полки для ванной',
      tabMetric: '−18%',
      title: 'Белый импорт на 18% дешевле карго',
      before: 'Полки для ванной возили карго: без документов на ввоз, с риском потерять партию и карточки на Wildberries.',
      done: [
        'Проверили схему на собственном бренде: оформили сертификацию и полный пакет транспортных документов',
        'Перевели поставки на автодоставку в белую',
        'Провели 5 поставок подряд без единого сбоя'
      ],
      metrics: [
        { value: '−18%', label: 'к стоимости против карго' },
        { value: 'на 7-10 дней', label: 'быстрее' },
        { value: '21 000 полок', label: 'за 5 поставок' }
      ],
      photos: [
        { src: 'assets/cases/case05_polki_zagruzka-na-fabrike.jpg', caption: 'Загрузка партии на фабрике' },
        { src: 'assets/cases/case05_polki_markirovka-korobov.jpg', caption: 'Маркировка под официальный ввоз' }
      ],
      note: 'По этой схеме мы уже перевели с карго на белый импорт 17 компаний.'
    },
    {
      tab: 'Стеариновая кислота',
      tabMetric: '< 200 ₽/кг',
      title: 'Сырьё дешевле рынка через новый маршрут',
      before: 'Рынок стеариновой кислоты в России — 200-205 ₽/кг. Прямая доставка из Китая до Магнитогорска выходила дорого.',
      done: [
        'Провели пробную поставку 5 т — проверили качество и поставщика',
        'Пересобрали маршрут через Забайкальск и нашли перевозчика до Магнитогорска дешевле прямой доставки',
        'Масштабировали до 22 т по новой схеме'
      ],
      metrics: [
        { value: '< 200 ₽/кг', label: 'при рынке 200-205' },
        { value: '−$2 300', label: 'на логистике поставки' },
        { value: 'на 4 дня', label: 'быстрее' }
      ],
      photos: [
        { src: 'assets/cases/case06_stearin_syre-s-zavoda.jpg', caption: 'Сырьё с завода' },
        { src: 'assets/cases/case06_stearin_vygruzka-u-zakazchika.jpg', caption: 'Выгрузка у заказчика' }
      ]
    },
    {
      tab: 'Устройство плавного пуска 90 кВт',
      tabMetric: '55 дней',
      title: 'Оригинальное устройство до Магнитогорска за 55 дней',
      before: 'Заказчику нужно устройство плавного пуска мощностью 90 кВт с поставкой до Магнитогорска.',
      done: [
        'Нашли поставщика оригинального оборудования в Пекине, подготовили двуязычный контракт и отгрузочные документы',
        'Подобрали логистику: для груза в 10 кг авиа вышло почти в 3 раза дешевле автосборки',
        'Оформили ввоз с декларацией и довезли до Магнитогорска'
      ],
      metrics: [
        { value: '55 дней', label: 'от заявки до склада' },
        { value: 'в 3 раза', label: 'дешевле доставка авиа против авто' },
        { value: '2 дня', label: 'на таможенное оформление' }
      ],
      photos: [
        { src: 'assets/cases/01_abb_obshchiy-vid.jpg', caption: 'Общий вид устройства' },
        { src: 'assets/cases/02_abb_etiketka-modeli.jpg', caption: 'Этикетка с моделью' }
      ]
    },
    {
      tab: 'Краски',
      tabMetric: '2 поставки',
      title: 'Опасный груз авиа — и повторный заказ через месяц',
      before: 'Заказчику нужны краски пяти цветов в литровых бутылках. Для авиаперевозки это опасный груз: без отчётов DGM и паспортов безопасности MSDS его не примут к вылету.',
      done: [
        'Перед вылетом нашли расхождение: фабрика подготовила отчёты DGM на бутылки 100 мл, а отгружала литровые. Переоформили 5 отчётов за 2 дня',
        'Груз прошёл таможню без претензий и доехал до склада заказчика',
        'Через месяц заказчик вернулся за второй партией — документы уже были готовы'
      ],
      metrics: [
        { value: '2 поставки', label: 'повторный заказ' },
        { value: '200 л', label: 'во второй партии' },
        { value: '13 дней', label: 'от заявки до Москвы' }
      ],
      photos: [
        { src: 'assets/cases/01_kraski_tovar-v-korobke.jpg', caption: 'Товар в коробке' },
        { src: 'assets/cases/02_kraski_promyvochnaya-zhidkost.jpg', caption: 'Промывочная жидкость' },
        { src: 'assets/cases/03_kraski_palleta-s-markirovkoy.jpg', caption: 'Паллета с маркировкой' }
      ]
    }
  ];

  var stage = document.getElementById('casesStage');
  var tabsBox = document.getElementById('casesTabs');
  var board = document.getElementById('casesBoard');
  if (!stage || !tabsBox || !board || !CASES.length) {
    return;
  }

  var countEl = document.getElementById('casesCount');
  var totalEl = document.getElementById('casesTotal');
  var barFill = document.getElementById('casesBarFill');
  var mark = tabsBox.querySelector('.cases__mark');

  var reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var laneMq = window.matchMedia('(max-width: 899.98px)');

  /* Тайминги продублированы из токенов: JS нужен их численный эквивалент,
     чтобы отмерить паузу между уходом и входом и длину счёта цифр.
     Единственный источник значений — всё равно docs/motion-spec.md. */
  var T_OUT = 200; // уход старой карточки
  var STAGGER = 70; // шаг очереди входа
  var COUNT_MS = 900; // досчёт цифр результата
  var METRICS_STEP = 4; // цифры — пятый элемент очереди (номер, заголовок, было, что сделали, цифры, фото)
  var MARK_BASE = 100; // опорная высота коралловой черты, масштабируется scaleY

  var pad = function (n) {
    return n < 10 ? '0' + n : String(n);
  };
  var TOTAL = pad(CASES.length);

  /* ==========================================================
     Сборка разметки
     ========================================================== */

  function buildTab(item, i) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cases__tab';
    btn.id = 'case-tab-' + i;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-controls', 'case-panel-' + i);
    btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    btn.tabIndex = i === 0 ? 0 : -1;
    btn.innerHTML =
      '<span class="cases__tab-ix">' + pad(i + 1) + '</span>' +
      '<span class="cases__tab-nm"></span>' +
      '<span class="cases__tab-mt"></span>';
    btn.querySelector('.cases__tab-nm').textContent = item.tab;
    btn.querySelector('.cases__tab-mt').textContent = item.tabMetric;
    btn.addEventListener('click', function () {
      go(i, i > active ? 1 : -1, true);
    });
    return btn;
  }

  function buildPhoto(photo) {
    var fig = document.createElement('figure');
    fig.className = 'cases__photo';

    var img = document.createElement('img');
    img.className = 'cases__photo-img';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = '';

    /* sheet — кадр не фотографический: чертёж на белом листе. Обрезать его
       нельзя, у краёв стоят размеры, поэтому в CSS у этой фигуры contain
       вместо cover, белая подложка, рамка и тёмная подпись вместо светлой
       поверх градиента. Класс — css/styles.css §10.2. */
    if (photo.sheet) {
      fig.classList.add('cases__photo--sheet');
    }

    /* focus — точка кадра, которая обязана остаться видимой при обрезке.
       Сейчас все файлы ровно 4:3, как и сама фигура, поэтому обрезки нет;
       значение держит главный объект в кадре (у 01-second — сам пресс, он
       сидит выше середины), если файл заменят на снимок других пропорций. */
    if (photo.focus) {
      img.style.objectPosition = photo.focus;
    }
    /* tone — правка яркости/насыщенности одного конкретного снимка, чтобы
       он не выбивался из ряда. Общего фильтра на .cases__photo-img нет:
       остальные фото трогать нельзя. Классы — css/styles.css §10.2. */
    if (photo.tone) {
      img.classList.add('cases__photo-img--' + photo.tone);
    }

    img.src = photo.src;

    var cap = document.createElement('figcaption');
    cap.className = 'cases__photo-cap';
    cap.textContent = photo.caption;

    fig.appendChild(img);
    fig.appendChild(cap);
    return fig;
  }

  function buildCard(item, i) {
    var card = document.createElement('article');
    card.className = 'cases__card';
    card.id = 'case-panel-' + i;
    card.setAttribute('role', 'tabpanel');
    card.setAttribute('aria-labelledby', 'case-tab-' + i);
    card.tabIndex = i === 0 ? 0 : -1;

    /* Линия сверху карточки — прочерчивается заново на каждом входе. */
    var line = document.createElement('span');
    line.className = 'cases__line';
    line.setAttribute('aria-hidden', 'true');
    card.appendChild(line);

    var num = document.createElement('p');
    num.className = 'cases__num cases__part';
    num.style.setProperty('--i', '0');
    num.innerHTML =
      '<span class="cases__num-roll"><span class="cases__num-cur">' + pad(i + 1) + '</span></span>' +
      '<span class="cases__num-of"> / ' + TOTAL + '</span>';
    card.appendChild(num);

    /* Заголовок карточки называет только продукт/задачу; клиентские бренды
       в кейсах не показываем. */
    var title = document.createElement('h3');
    title.className = 'cases__card-title cases__part';
    title.style.setProperty('--i', '1');
    var tProduct = document.createElement('span');
    tProduct.className = 'cases__card-product';
    tProduct.textContent = item.tab;
    title.appendChild(tProduct);
    card.appendChild(title);

    /* Итог кейса — мелкой строкой под заголовком. */
    var result = document.createElement('p');
    result.className = 'cases__result cases__part';
    result.style.setProperty('--i', '2');
    result.textContent = item.title;
    card.appendChild(result);

    var before = document.createElement('div');
    before.className = 'cases__block cases__part';
    before.style.setProperty('--i', '2');
    before.innerHTML = '<p class="cases__label">Было</p><p class="cases__before"></p>';
    before.querySelector('.cases__before').textContent = item.before;
    card.appendChild(before);

    var done = document.createElement('div');
    done.className = 'cases__block cases__part';
    done.style.setProperty('--i', '3');
    done.innerHTML = '<p class="cases__label">Что сделали</p><ul class="cases__done"></ul>';
    var list = done.querySelector('.cases__done');
    item.done.forEach(function (row) {
      var li = document.createElement('li');
      li.textContent = row;
      list.appendChild(li);
    });
    card.appendChild(done);

    var metrics = document.createElement('ul');
    metrics.className = 'cases__metrics cases__part';
    metrics.style.setProperty('--i', String(METRICS_STEP));
    item.metrics.forEach(function (m) {
      var li = document.createElement('li');
      li.className = 'cases__metric';
      var v = document.createElement('span');
      v.className = 'cases__metric-v';
      v.textContent = m.value;
      var l = document.createElement('span');
      l.className = 'cases__metric-l';
      l.textContent = m.label;
      li.appendChild(v);
      li.appendChild(l);
      metrics.appendChild(li);
    });
    card.appendChild(metrics);

    /* Нет фото — ряд с фото не выводим, карточка заканчивается цифрами. */
    if (item.photos && item.photos.length) {
      var photos = document.createElement('div');
      photos.className = 'cases__photos cases__part';
      photos.style.setProperty('--i', '5');
      item.photos.forEach(function (p) {
        photos.appendChild(buildPhoto(p));
      });
      card.appendChild(photos);
    }

    /* Строка под карточкой (например, «17 компаний» у полок). */
    if (item.note) {
      var note = document.createElement('p');
      note.className = 'cases__note cases__part';
      note.style.setProperty('--i', '6');
      note.textContent = item.note;
      card.appendChild(note);
    }

    return card;
  }

  var tabs = [];
  var cards = [];
  CASES.forEach(function (item, i) {
    var tab = buildTab(item, i);
    tabsBox.appendChild(tab);
    tabs.push(tab);

    var card = buildCard(item, i);
    stage.appendChild(card);
    cards.push(card);
  });

  if (totalEl) {
    totalEl.textContent = String(CASES.length);
  }
  if (barFill) {
    barFill.style.setProperty('--n', String(CASES.length));
  }

  /* ==========================================================
     Досчёт цифр результата — только при первом показе кейса.
     Кривая та же, что у смены состояний в системе: --e-inout.
     ========================================================== */
  var NBSP = ' ';

  function bezier(x) {
    /* cubic-bezier(.65, 0, .35, 1) — численно, чтобы не тянуть зависимость.
       Достаточно нескольких итераций Ньютона: точность счётчика не выше
       одного кадра. */
    var p1 = 0.65;
    var p2 = 0.35;
    var t = x;
    var i;
    var cx;
    var dx;
    for (i = 0; i < 6; i++) {
      cx = 3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t;
      dx = 3 * (1 - t) * (1 - t) * p1 + 6 * (1 - t) * t * (p2 - p1) + 3 * t * t * (1 - p2);
      if (dx === 0) {
        break;
      }
      t -= (cx - x) / dx;
    }
    t = Math.max(0, Math.min(1, t));
    return 3 * (1 - t) * (1 - t) * t * 0 + 3 * (1 - t) * t * t * 1 + t * t * t;
  }

  /* Разбор значения вида «700 000 ₽», «3,9 млн ₽», «90 дней», «По ТЗ»:
     считается только ведущее число, хвост строки остаётся как есть.
     Разряды («700 000») забираются в число целиком, а пробел перед словом
     («30 фабрик») — уже хвост и в число не попадает. */
  function parseValue(text) {
    var m = /^(\d{1,3}(?:[\s ]\d{3})+|\d+)(?:,(\d+))?/.exec(text);
    if (!m) {
      return null;
    }
    var intPart = m[1].replace(/[\s ]/g, '');
    var dec = m[2] || '';
    return {
      target: parseFloat(intPart + (dec ? '.' + dec : '')),
      decimals: dec.length,
      grouped: /[\s ]/.test(m[1]),
      rest: text.slice(m[0].length)
    };
  }

  function formatValue(v, spec) {
    var s = v.toFixed(spec.decimals);
    var parts = s.split('.');
    if (spec.grouped) {
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
    }
    return (parts[1] ? parts[0] + ',' + parts[1] : parts[0]) + spec.rest;
  }

  var counted = [];
  var rafs = [];
  var counting = []; // цифры в процессе счёта — чтобы прерванный счёт не застыл на полпути

  function countCard(index) {
    if (counted[index]) {
      return;
    }
    /* В ленте счёт ждёт первого показа: на телефоне все три карточки
       существуют с загрузки страницы, и без этой проверки цифры
       досчитывались бы задолго до того, как блок доехал до экрана. */
    if (laneMq.matches && !laneSeen) {
      return;
    }
    counted[index] = true;

    var nodes = [].slice.call(cards[index].querySelectorAll('.cases__metric-v'));
    nodes.forEach(function (node) {
      var full = node.textContent;
      var spec = parseValue(full);
      if (!spec) {
        return;
      }
      node.textContent = formatValue(0, spec);
      counting.push({ node: node, full: full });

      var start = 0;
      var id = window.requestAnimationFrame(function step(now) {
        if (!start) {
          start = now;
        }
        var p = Math.min(1, (now - start) / COUNT_MS);
        node.textContent = formatValue(spec.target * bezier(p), spec);
        if (p < 1) {
          id = window.requestAnimationFrame(step);
          rafs.push(id);
        } else {
          node.textContent = full;
        }
      });
      rafs.push(id);
    });
  }

  function countAllNow() {
    cards.forEach(function (card, i) {
      counted[i] = true;
    });
  }

  /* ==========================================================
     Переключение
     ========================================================== */
  var active = -1;
  var timers = [];

  function clearPending() {
    timers.forEach(clearTimeout);
    timers = [];
    rafs.forEach(function (id) {
      window.cancelAnimationFrame(id);
    });
    rafs = [];
    /* Счёт, прерванный новым кликом, не бросается на середине — цифра
       ставится в конечное значение, кейс считается показанным. */
    counting.forEach(function (c) {
      c.node.textContent = c.full;
    });
    counting = [];
  }

  function later(fn, ms) {
    timers.push(setTimeout(fn, ms));
  }

  function hideNow(card) {
    card.classList.remove('is-shown', 'is-out');
    card.style.removeProperty('--sx');
    card.style.removeProperty('--ox');
    card.tabIndex = -1;
  }

  function showNow(card) {
    card.classList.remove('is-out');
    card.classList.add('is-shown');
    card.style.removeProperty('--sx');
  }

  function enter(card, index, dir) {
    /* Направление: следующий кейс въезжает справа, предыдущий — слева. */
    card.style.setProperty('--sx', (dir >= 0 ? 24 : -24) + 'px');
    card.classList.remove('is-shown', 'is-out');
    void card.offsetWidth; // зафиксировать стартовое состояние до включения переходов
    card.classList.add('is-shown');
    card.tabIndex = 0;

    if (!counted[index]) {
      later(function () {
        countCard(index);
      }, METRICS_STEP * STAGGER);
    }
  }

  function syncTabs(index) {
    tabs.forEach(function (tab, i) {
      var on = i === index;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      tab.classList.toggle('is-active', on);
    });
    moveMark(index);
  }

  function moveMark(index) {
    if (!mark || laneMq.matches) {
      return;
    }
    var tab = tabs[index];
    if (!tab) {
      return;
    }
    /* Черта переезжает только через transform: сдвиг + масштаб по высоте
       от опорных MARK_BASE px, чтобы не анимировать height. */
    mark.style.transform =
      'translateY(' + tab.offsetTop + 'px) scaleY(' + tab.offsetHeight / MARK_BASE + ')';
    mark.classList.add('is-on');
  }

  function syncMeter(index) {
    if (countEl) {
      countEl.textContent = String(index + 1);
    }
    if (barFill) {
      barFill.style.setProperty('--i', String(index));
    }
  }

  /* Полоса прогресса под лентой идёт вместе с ней, а не перескакивает по
     остановкам: --p (0…1) считается из фактического scrollLeft, сдвиг
     полосы живёт в CSS (§10.5), своей анимации у неё нет. За кадр
     выставляется одно свойство, и это transform — запрет №1 соблюдён. */
  function laneProgress() {
    if (!barFill) {
      return;
    }
    var max = stage.scrollWidth - stage.clientWidth;
    var p = max > 0 ? stage.scrollLeft / max : 0;
    barFill.style.setProperty('--p', String(Math.max(0, Math.min(1, p))));
  }

  function go(index, dir, fromUser) {
    if (index < 0 || index >= cards.length) {
      return;
    }
    if (index === active) {
      return;
    }

    clearPending();

    var prev = active >= 0 ? cards[active] : null;
    var next = cards[index];
    var direction = typeof dir === 'number' ? dir : index > active ? 1 : -1;
    active = index;

    syncTabs(index);
    syncMeter(index);

    /* Всё, что не участвует в текущей паре, гасится немедленно: прерванный
       переход не должен доигрывать свой хвост поверх нового. */
    cards.forEach(function (card) {
      if (card !== prev && card !== next) {
        hideNow(card);
      }
    });

    if (laneMq.matches) {
      scrollLaneTo(index, fromUser);
      countCard(index);
      return;
    }

    if (reduceMq.matches) {
      if (prev && prev !== next) {
        hideNow(prev);
      }
      countAllNow();
      showNow(next);
      next.tabIndex = 0;
      return;
    }

    if (prev && prev !== next) {
      prev.style.setProperty('--ox', (direction >= 0 ? -8 : 8) + 'px');
      prev.classList.add('is-out');
      prev.tabIndex = -1;
      later(function () {
        hideNow(prev);
        enter(next, index, direction);
      }, T_OUT);
    } else {
      enter(next, index, direction);
    }
  }

  /* ==========================================================
     Мобильная лента: карточки показаны все сразу, переход делает скролл.
     Скрипт ведёт счётчик, полосу прогресса и активную вкладку.
     ========================================================== */
  /* Шаг ленты = расстояние между началами соседних карточек. Берётся из
     фактической раскладки, а не из процентов в CSS: ширина карточки и
     зазор заданы в токенах и меняются вместе с ними. */
  function laneStep() {
    return cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : stage.clientWidth;
  }

  function scrollLaneTo(index, smooth) {
    if (!cards[index]) {
      return;
    }
    stage.scrollTo({
      left: laneStep() * index,
      behavior: smooth && !reduceMq.matches ? 'smooth' : 'auto'
    });
  }

  var laneTick = 0;
  stage.addEventListener(
    'scroll',
    function () {
      if (!laneMq.matches || laneTick) {
        return;
      }
      laneTick = window.requestAnimationFrame(function () {
        laneTick = 0;
        laneProgress();
        var step = laneStep() || 1;
        var i = Math.max(0, Math.min(cards.length - 1, Math.round(stage.scrollLeft / step)));
        if (i !== active) {
          active = i;
          syncTabs(i);
          syncMeter(i);
          /* Карточка стала текущей — её цифры досчитываются здесь,
             при первом показе и только один раз. */
          countCard(i);
        }
      });
    },
    { passive: true }
  );

  /* ==========================================================
     Первый показ ленты. Порог 0.1 вместо десктопных 0.18
     (docs/mobile-spec.md §3): на коротком экране высокая карточка может
     никогда не набрать 18% своей высоты в окне.
     ========================================================== */
  var laneSeen = false;
  var laneIo = null;

  function watchLane() {
    if (laneSeen) {
      countCard(active);
      return;
    }
    if (reduceMq.matches) {
      /* Движения нет — цифры сразу в конечном значении. */
      laneSeen = true;
      countAllNow();
      return;
    }
    if (typeof IntersectionObserver !== 'function') {
      laneSeen = true;
      countCard(active);
      return;
    }
    if (laneIo) {
      return;
    }
    laneIo = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return;
          }
          laneIo.disconnect();
          laneIo = null;
          laneSeen = true;
          countCard(active);
        });
      },
      { threshold: 0.1 }
    );
    laneIo.observe(board);
  }

  function applyLane() {
    clearPending();
    if (laneMq.matches) {
      /* В ленте все карточки в конечном состоянии — своего перехода там нет,
         переключение делает сам скролл. */
      cards.forEach(function (card) {
        showNow(card);
        card.tabIndex = 0;
      });
      if (active < 0) {
        active = 0;
      }
      syncTabs(active);
      syncMeter(active);
      laneProgress();
      /* Свайп в ленте — нативный скролл. Свои обработчики touch здесь не
         просто молчат, а сняты совсем. */
      unbindSwipe();
      watchLane();
      if (mark) {
        mark.classList.remove('is-on');
      }
    } else {
      bindSwipe();
      cards.forEach(function (card, i) {
        if (i !== active) {
          hideNow(card);
        }
      });
      if (active < 0) {
        first();
      } else {
        showNow(cards[active]);
        cards[active].tabIndex = 0;
        syncTabs(active);
        syncMeter(active);
      }
    }
  }

  /* ==========================================================
     Клавиатура и свайп
     ========================================================== */
  board.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
      return;
    }
    var dir = e.key === 'ArrowRight' ? 1 : -1;
    var next = active + dir;
    if (next < 0 || next >= cards.length) {
      return;
    }
    e.preventDefault();
    go(next, dir, true);
    if (!laneMq.matches && document.activeElement && document.activeElement.classList.contains('cases__tab')) {
      tabs[next].focus();
    }
  });

  /* Свайп по карточке на десктопной ширине (сенсорный экран, вкладки далеко
     от пальца). В ленте < 900px листание — нативный scroll-snap, поэтому там
     обработчики не висят вовсе: applyLane их снимает. */
  var touchX = null;
  var touchY = null;
  var swipeOn = false;

  function onTouchStart(e) {
    if (e.touches.length !== 1) {
      touchX = null;
      return;
    }
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
  }

  function onTouchEnd(e) {
    if (touchX === null || !e.changedTouches.length) {
      return;
    }
    var dx = e.changedTouches[0].clientX - touchX;
    var dy = e.changedTouches[0].clientY - touchY;
    touchX = null;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) {
      return;
    }
    var dir = dx < 0 ? 1 : -1;
    var next = active + dir;
    if (next >= 0 && next < cards.length) {
      go(next, dir, true);
    }
  }

  function bindSwipe() {
    if (swipeOn) {
      return;
    }
    swipeOn = true;
    stage.addEventListener('touchstart', onTouchStart, { passive: true });
    stage.addEventListener('touchend', onTouchEnd, { passive: true });
  }

  function unbindSwipe() {
    if (!swipeOn) {
      return;
    }
    swipeOn = false;
    touchX = null;
    stage.removeEventListener('touchstart', onTouchStart);
    stage.removeEventListener('touchend', onTouchEnd);
  }

  /* ==========================================================
     Первое появление. Шапка, вкладки и строка под блоком идут обычным
     .reveal (js/reveal.js), первый кейс входит тем же переходом, что и при
     переключении — по достижении блока, без скролл-привязки внутри него.
     ========================================================== */
  function first() {
    active = -1;
    go(0, 1, false);
  }

  function boot() {
    if (laneMq.matches) {
      active = 0;
      applyLane();
      return;
    }
    /* Десктопная ширина: свайп по карточке остаётся под рукой. В ленте его
       снимает applyLane. */
    bindSwipe();
    if (reduceMq.matches || typeof IntersectionObserver !== 'function') {
      first();
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            io.unobserve(entry.target);
            first();
          }
        });
      },
      { threshold: 0.18 }
    );
    io.observe(board);
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      moveMark(active);
      if (laneMq.matches) {
        laneProgress();
      }
    }, 150);
  });

  function onLaneChange() {
    applyLane();
  }
  if (typeof laneMq.addEventListener === 'function') {
    laneMq.addEventListener('change', onLaneChange);
  } else if (typeof laneMq.addListener === 'function') {
    laneMq.addListener(onLaneChange);
  }

  boot();

  /* Шрифт подменяет метрики уже после первой раскладки — черта вкладки
     пересчитывается по загрузке, иначе она может встать по старой высоте. */
  window.addEventListener('load', function () {
    moveMark(active);
  });
})();