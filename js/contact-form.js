/*
  COREX — финальная контактная форма.
  Владеет: валидацией и псевдо-отправкой формы #contact-form.
  Выставляет: обработчик сабмита, состояние отправки в #contact-form-status.
  Прячет: то, что реального бэкенда нет — это единственная зона ответственности
  этого файла; про calculator.js/animations.js ничего не знает.
*/

(function () {
  'use strict';

  var form = document.getElementById('contact-form');
  var statusEl = document.getElementById('contact-form-status');

  if (!form || !statusEl) {
    return;
  }

  var fields = {
    name: document.getElementById('contact-name'),
    contact: document.getElementById('contact-contact'),
    product: document.getElementById('contact-product')
  };

  var submitBtn = form.querySelector('.final-cta__submit');
  var submitLabel = submitBtn ? submitBtn.querySelector('.final-cta__submit-label') : null;
  var defaultSubmitLabel = submitLabel ? submitLabel.textContent : 'Отправить заявку';

  function setSubmitState(state) {
    if (submitBtn) {
      submitBtn.setAttribute('data-state', state);
    }
  }

  function setError(key, message) {
    var input = fields[key];
    var errorEl = document.getElementById('contact-' + key + '-error');
    var wrap = input ? input.closest('.form-field') : null;

    if (errorEl) {
      errorEl.textContent = message || '';
    }
    if (wrap) {
      wrap.classList.toggle('has-error', Boolean(message));
    }
  }

  function clearErrors() {
    Object.keys(fields).forEach(function (key) {
      setError(key, '');
    });
  }

  function setStatus(message, variant) {
    statusEl.textContent = message || '';
    statusEl.classList.remove('form-status--success');
    if (variant === 'success') {
      statusEl.classList.add('form-status--success');
    }
  }

  function validate() {
    clearErrors();
    var isValid = true;
    var firstInvalid = null;

    var name = fields.name.value.trim();
    if (!name) {
      setError('name', 'Укажите, как к вам обращаться');
      isValid = false;
      firstInvalid = firstInvalid || fields.name;
    }

    var contact = fields.contact.value.trim();
    if (!contact) {
      setError('contact', 'Оставьте телефон, email или Telegram');
      isValid = false;
      firstInvalid = firstInvalid || fields.contact;
    }

    var product = fields.product.value.trim();
    if (!product) {
      setError('product', 'Опишите, что за товар и примерный объём');
      isValid = false;
      firstInvalid = firstInvalid || fields.product;
    }

    return { isValid: isValid, firstInvalid: firstInvalid, name: name, contact: contact, product: product };
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    setStatus('');

    var validation = validate();
    if (!validation.isValid) {
      if (validation.firstInvalid) {
        validation.firstInvalid.focus();
      }
      return;
    }

    var payload = {
      name: validation.name,
      contact: validation.contact,
      product: validation.product,
      need: form.elements.need ? form.elements.need.value : '',
      link: form.elements.link ? form.elements.link.value.trim() : '',
      submittedAt: new Date().toISOString()
    };

    // TODO: подключить реальный endpoint (CRM/почта/Telegram-бот).
    // Пока заявка нигде не сохраняется — только логируется в консоль.
    console.log('[COREX] Новая заявка (черновой приём, без бэкенда):', payload);

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (submitBtn) {
      submitBtn.disabled = true;
    }
    setSubmitState('sending');

    // Пауза перед «отправлено» — та же логика, что и у калькулятора:
    // мгновенный результат читается как подделка. Реального запроса нет
    // (см. TODO выше), поэтому пауза здесь чисто декоративная.
    window.setTimeout(
      function () {
        setSubmitState('sent');
        if (submitLabel) {
          submitLabel.textContent = 'Заявка отправлена';
        }

        setStatus('Спасибо! Заявка отправлена — мы свяжемся с вами в ближайшее время.', 'success');
        form.reset();
        clearErrors();

        window.setTimeout(
          function () {
            if (submitBtn) {
              submitBtn.disabled = false;
            }
            setSubmitState('idle');
            if (submitLabel) {
              submitLabel.textContent = defaultSubmitLabel;
            }
          },
          reduce ? 0 : 2600
        );
      },
      reduce ? 0 : 600
    );
  });
})();
