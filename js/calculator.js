/*
  COREX — калькулятор полной стоимости партии на складе.
  Владеет: состоянием блока #calculator (id="cc-*") и расчётом разбивки
  стоимости в реальном времени — товар, логистика, пошлина, НДС, оформление.
  Логика расчёта перенесена без изменений из docs/corex-calc_4.html
  (см. CLAUDE.md, «Перенос блоков из docs/ref-*.html»): ставки логистики
  по весовым уровням с поправкой на плотность, таможенные сборы по сетке,
  НДС от таможенной стоимости вместе с пошлиной, фиксированные суммы за
  брокера и страховку.

  Выставляет: заполнение #contact-product и скролл к #contacts по кнопке
  «Посчитать точно по моему товару» — та же точка соприкосновения с формой
  раздела 9, что и раньше (id="contact-name" и т.д., см. тикет 02).
  Ничего не импортирует и не знает про js/animations.js или js/contact-form.js.
*/

(function () {
  'use strict';

  var root = document.getElementById('calculator');
  if (!root) {
    return;
  }

  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ЗАГЛУШКА: подставлять актуальный курс ЦБ на дату показа.
  var USD = 95;
  // Ставка НДС с 01.01.2026.
  var VAT = 0.22;
  // Оформление декларации, ₽.
  var BROKER = 20500;
  // Страховка от стоимости товара.
  var INS = 0.001;
  // Доля фрахта «до границы» в таможенной стоимости.
  var BORDER = 0.6;

  var CATS = [
    ['Промышленное оборудование', 0.05],
    ['Робототехника и автоматизация', 0.05],
    ['Платы, электроника и компоненты', 0.05],
    ['Комплектующие и запчасти', 0.05],
    ['Складское и упаковочное оборудование', 0.05],
    ['Товары для маркетплейсов', 0.08],
    ['Другое — впишу сам', null]
  ];

  var FEES = [
    [200000, 1231],
    [450000, 2462],
    [1200000, 4924],
    [2700000, 13541],
    [4200000, 18465],
    [5500000, 21344],
    [10000000, 49240],
    [Infinity, 73860]
  ];

  var rootStyle = getComputedStyle(document.documentElement);
  function cssVar(name) {
    return rootStyle.getPropertyValue(name).trim();
  }

  var SEGS = [
    ['goods', 'Товар на фабрике', cssVar('--color-accent-primary'), ''],
    ['log', 'Логистика до склада', cssVar('--color-blue-400'), 'вес × ставка по весовому уровню'],
    ['duty', 'Таможенная пошлина', cssVar('--color-blue-300'), ''],
    ['vat', 'НДС 22 %', cssVar('--color-blue-200'), 'от таможенной стоимости вместе с пошлиной, а не от цены товара'],
    ['fees', 'Оформление', cssVar('--color-neutral-500'), 'таможенный сбор, брокер, страховка']
  ];

  var $ = function (id) {
    return document.getElementById(id);
  };
  var cl = function (v, a, b) {
    return v < a ? a : v > b ? b : v;
  };
  var fmt = function (n) {
    return Math.round(n)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };
  var parse = function (s) {
    var v = parseFloat(String(s).replace(/[^\d.,]/g, '').replace(',', '.'));
    return isFinite(v) ? v : 0;
  };

  function rateAuto(w, dens) {
    var r = w <= 50 ? 400 : w <= 150 ? 320 : w <= 300 ? 280 : w <= 600 ? 220 : 100;
    if (w > 900 && dens > 310) {
      r = r * cl(1 - ((dens - 310) / 250) * 0.4, 0.6, 1);
    }
    return r;
  }
  function rateAir(w) {
    return w <= 50 ? 427 : w <= 150 ? 379 : w <= 300 ? 395 : 350;
  }
  function fee(v) {
    for (var i = 0; i < FEES.length; i++) {
      if (v <= FEES[i][0]) {
        return FEES[i][1];
      }
    }
  }

  var cat = 0;
  var pick = null; // выбранный вручную способ: 'auto' | 'air' | null
  var lastState = null; // снимок последнего update() — для кнопки «Посчитать точно»

  var rateEl = $('cc-rate');
  if (rateEl) {
    rateEl.textContent = 'курс ' + USD.toFixed(2).replace('.', ',') + ' ₽/$';
  }

  /* Категория выбирается двумя органами управления сразу: плашками
     (десктоп) и нативным списком (телефон, docs/mobile-spec.md §7).
     Показывает нужный CSS по брейкпоинту, но состояние у них общее —
     поэтому выбор сведён в одну функцию, а не продублирован в двух
     обработчиках. Нативный список на телефоне выигрывает у семи плашек
     по высоте и открывается системным колесом, к которому рука уже
     приучена. */
  var chipsEl = $('cc-chips');
  var catSelect = $('cc-cat-select');

  function selectCat(i, focusCustom) {
    cat = i;
    Array.prototype.slice.call(chipsEl.children).forEach(function (x, j) {
      x.classList.toggle('is-on', j === i);
    });
    if (catSelect && catSelect.selectedIndex !== i) {
      catSelect.selectedIndex = i;
    }
    var isCustom = CATS[i][1] === null;
    $('cc-custom').classList.toggle('is-open', isCustom);
    if (isCustom && focusCustom) {
      window.setTimeout(function () {
        $('cc-cname').focus();
      }, 120);
    }
    update();
  }

  CATS.forEach(function (c, i) {
    var b = document.createElement('button');
    b.className = 'cc-calc__chip' + (i === 0 ? ' is-on' : '');
    b.type = 'button';
    b.textContent = c[0];
    b.addEventListener('click', function () {
      selectCat(i, true);
    });
    chipsEl.appendChild(b);

    if (catSelect) {
      var o = document.createElement('option');
      o.value = String(i);
      o.textContent = c[0];
      catSelect.appendChild(o);
    }
  });

  if (catSelect) {
    catSelect.selectedIndex = 0;
    catSelect.addEventListener('change', function () {
      selectCat(catSelect.selectedIndex, true);
    });
  }

  var bar = $('cc-bar');
  var rowsEl = $('cc-rows');
  SEGS.forEach(function (s, i) {
    var seg = document.createElement('div');
    seg.className = 'cc-calc__bar-seg';
    seg.dataset.k = s[0];
    seg.style.background = s[2];
    seg.style.transform = 'translateX(0) scaleX(0)';
    bar.appendChild(seg);

    var li = document.createElement('li');
    li.className = 'cc-calc__row' + (i === 0 ? ' cc-calc__row--head' : '');
    li.dataset.k = s[0];
    li.innerHTML =
      '<span class="cc-calc__row-dot" style="background:' + s[2] + '"></span>' +
      '<span class="cc-calc__row-nm">' + s[1] + (s[3] ? '<small>' + s[3] + '</small>' : '') + '</span>' +
      '<span class="cc-calc__row-vl" data-num="' + s[0] + '">0 ₽</span>';
    rowsEl.appendChild(li);
  });

  var nums = {};
  var targets = {};
  var cur = {};
  Array.prototype.slice.call(root.querySelectorAll('[data-num]')).forEach(function (el) {
    nums[el.dataset.num] = el;
    targets[el.dataset.num] = 0;
    cur[el.dataset.num] = 0;
  });

  // Цифры не появляются мгновенно, а плавно доезжают до нового значения —
  // экспоненциальное приближение к цели, а не CSS-переход (анимируется
  // текстовое содержимое). При reduced-motion — конечное состояние сразу.
  //
  // Цикл засыпает, как только все значения доехали, и заводится заново из
  // update() при правке любого поля. Раньше он крутился от загрузки
  // страницы и до её закрытия, переписывая textContent одиннадцати узлов
  // каждый кадр — даже когда калькулятор был далеко за экраном и ни одно
  // число не менялось.
  var numsRunning = false;
  var lastText = {};
  var lastFrameTs = 0;

  function tick(ts) {
    var dt = lastFrameTs ? Math.min(ts - lastFrameTs, 100) : 16.67;
    lastFrameTs = ts;
    // Шаг приближения не зависит от частоты кадров: при 0.18 на кадр
    // счётчик на 120 Гц доезжал вдвое быстрее, чем на 60 Гц.
    var k = 1 - Math.pow(1 - 0.18, dt / 16.67);

    var busy = false;
    for (var key in nums) {
      if (REDUCE) {
        cur[key] = targets[key];
      } else {
        var d = targets[key] - cur[key];
        if (Math.abs(d) > 0.5) {
          cur[key] += d * k;
          busy = true;
        } else {
          cur[key] = targets[key];
        }
      }
      var text = fmt(cur[key]) + (key === 'pct' ? '' : ' ₽');
      if (text !== lastText[key]) {
        lastText[key] = text;
        nums[key].textContent = text;
      }
    }

    if (busy) {
      requestAnimationFrame(tick);
    } else {
      numsRunning = false;
      lastFrameTs = 0;
    }
  }

  function runNums() {
    if (numsRunning) {
      return;
    }
    numsRunning = true;
    lastFrameTs = 0;
    requestAnimationFrame(tick);
  }

  function dutyRate() {
    var r = CATS[cat][1];
    if (r !== null) {
      return r;
    }
    return cl(parse($('cc-crate').value) / 100, 0, 0.5);
  }

  function update() {
    var goods = parse($('cc-value').value);
    var w = Math.max(1, parse($('cc-weight').value));
    var volIn = parse($('cc-vol').value);
    var qty = parse($('cc-qty').value);
    var noVat = !$('cc-vat').checked;
    var vol = volIn > 0 ? volIn : w / 250;
    var dens = w / vol;

    var rA = rateAuto(w, dens);
    var rR = rateAir(w);
    var logA = w * rA;
    var logR = w * rR;
    var goodsR = goods * USD;
    // методика: авиа берём, если переплата не больше ~10 ₽/шт; без количества — 1 % от цены партии
    var thr = qty > 0 ? qty * 10 : goodsR * 0.01;
    var rec = logR - logA < thr ? 'air' : 'auto';
    var use = pick || rec;
    var log = use === 'air' ? logR : logA;

    var ins = goodsR * INS;
    var custVal = goodsR + ins + log * BORDER;
    var duty = custVal * dutyRate();
    var vat = noVat ? 0 : (custVal + duty) * VAT;
    var fees = fee(custVal) + BROKER + ins;
    var addon = log + duty + vat + fees;
    var grand = goodsR + addon;

    targets.goods = goodsR;
    targets.log = log;
    targets.duty = duty;
    targets.vat = vat;
    targets.fees = fees;
    targets.grand = grand;
    targets.grand2 = grand;
    targets.pct = goodsR > 0 ? (addon / goodsR) * 100 : 0;
    targets.auto = logA;
    targets.air = logR;
    targets.unit = qty > 0 ? grand / qty : 0;

    $('cc-unit-row').classList.toggle('cc-calc__unit-row--hide', !(qty > 0));
    $('cc-range').textContent =
      'Диапазон с учётом разброса ставок: ' + fmt(grand * 0.93) + ' — ' + fmt(grand * 1.08) + ' ₽. ' +
      (noVat ? 'НДС исключён — принимается к вычету.' : 'НДС включён: на УСН он к вычету не принимается.');

    rowsEl.querySelector('[data-k=vat]').classList.toggle('cc-calc__row--off', noVat);

    $('cc-mode-auto').classList.toggle('is-on', use === 'auto');
    $('cc-mode-air').classList.toggle('is-on', use === 'air');
    $('cc-mode-auto').classList.toggle('is-rec', rec === 'auto' && use !== 'auto');
    $('cc-mode-air').classList.toggle('is-rec', rec === 'air' && use !== 'air');
    $('cc-reset').classList.toggle('cc-calc__reset--hide', !pick || pick === rec);

    var off = 0;
    var vals = { goods: goodsR, log: log, duty: duty, vat: vat, fees: fees };
    Array.prototype.slice.call(bar.querySelectorAll('.cc-calc__bar-seg')).forEach(function (s) {
      var share = grand > 0 ? vals[s.dataset.k] / grand : 0;
      s.style.transform = 'translateX(' + (off * 100).toFixed(2) + '%) scaleX(' + share.toFixed(4) + ')';
      off += share;
    });

    lastState = {
      categoryLabel: CATS[cat][1] === null ? ($('cc-cname').value.trim() || 'другое') : CATS[cat][0],
      weight: w,
      volume: volIn,
      qty: qty,
      methodLabel: use === 'air' ? 'авиа' : 'авто',
      grand: grand
    };

    runNums();
  }

  ['cc-value', 'cc-weight', 'cc-vol', 'cc-qty', 'cc-crate', 'cc-cname'].forEach(function (id) {
    var el = $(id);
    el.addEventListener('input', update);
  });
  ['cc-value', 'cc-weight', 'cc-vol', 'cc-qty', 'cc-crate'].forEach(function (id) {
    var el = $(id);
    el.addEventListener('blur', function () {
      var v = parse(el.value);
      if (!v) {
        if (id !== 'cc-crate') {
          el.value = '';
        }
        update();
        return;
      }
      el.value = id === 'cc-vol' || id === 'cc-crate' ? String(v).replace('.', ',') : fmt(v);
      update();
    });
  });

  $('cc-vat').addEventListener('change', update);
  $('cc-mode-auto').addEventListener('click', function () {
    pick = 'auto';
    update();
  });
  $('cc-mode-air').addEventListener('click', function () {
    pick = 'air';
    update();
  });
  $('cc-reset').addEventListener('click', function () {
    pick = null;
    update();
  });

  var sendBtn = $('cc-send-request');
  if (sendBtn) {
    sendBtn.addEventListener('click', function () {
      if (!lastState) {
        return;
      }
      var product = $('contact-product');
      var contactsSection = $('contacts');
      var nameInput = $('contact-name');
      var volumeText = lastState.volume ? ', объём ' + lastState.volume + ' м³' : '';
      var qtyText = lastState.qty ? ', ' + lastState.qty + ' шт' : '';

      if (product) {
        product.value =
          lastState.categoryLabel + ', вес ' + lastState.weight + ' кг' + volumeText + qtyText +
          ', доставка ' + lastState.methodLabel + '. Прикидка с сайта: ' + fmt(lastState.grand) + ' ₽ на складе.';
      }

      if (contactsSection) {
        contactsSection.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'start' });
      }

      if (nameInput) {
        window.setTimeout(
          function () {
            nameInput.focus({ preventScroll: true });
          },
          REDUCE ? 0 : 400
        );
      }
    });
  }

  update();
})();
