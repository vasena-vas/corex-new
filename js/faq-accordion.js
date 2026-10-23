/*
  COREX — аккордеон «Вопросы».

  Нативный <details>/<summary> остаётся источником состояния (open,
  доступность с клавиатуры и для скринридеров — бесплатно от браузера).
  Проблема ровно одна: браузер прячет содержимое мгновенно, как только
  атрибут `open` снят, — grid-template-rows не успевает доиграть. Поэтому
  при закрытии этот файл сам держит `open` до конца transition и снимает
  его последним кадром, а не первым.

  Не GSAP, не зависит от animations.js — тот же принцип, что и у
  js/hero-panorama.js и js/reveal.js: аккордеон должен работать, даже если
  CDN с GSAP не загрузился.
*/
(function () {
  'use strict';

  var items = document.querySelectorAll('.faq-item');

  items.forEach(function (details) {
    var summary = details.querySelector('summary');
    var content = details.querySelector('.faq-item__content');
    if (!summary || !content) {
      return;
    }

    var closing = false;

    summary.addEventListener('click', function (event) {
      // Берём toggle на себя целиком: закрытие нужно проиграть, а не
      // отдать браузеру, который снял бы `open` (и спрятал контент) мгновенно.
      event.preventDefault();
      if (closing) {
        return;
      }

      if (details.open) {
        closeItem();
      } else {
        openItem();
      }
    });

    function openItem() {
      details.open = true;
      // Один кадр между простановкой `open` и добавлением класса — иначе
      // браузер схлопнёт переход в 0fr→1fr без промежуточных кадров.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          content.classList.add('is-open');
        });
      });
    }

    function closeItem() {
      closing = true;
      content.classList.remove('is-open');

      var settled = false;
      function finish() {
        if (settled) {
          return;
        }
        settled = true;
        content.removeEventListener('transitionend', onTransitionEnd);
        details.open = false;
        closing = false;
      }

      function onTransitionEnd(event) {
        if (event.target === content && event.propertyName === 'grid-template-rows') {
          finish();
        }
      }

      content.addEventListener('transitionend', onTransitionEnd);
      // Подстраховка: если transitionend не пришёл (например, элемент был
      // уже схлопнут при prefers-reduced-motion и браузер его не шлёт).
      // Запас над --duration-accordion (280ms).
      window.setTimeout(finish, 420);
    }
  });
})();
