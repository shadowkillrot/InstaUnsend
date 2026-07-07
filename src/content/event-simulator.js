/**
 * InstaUnsend — Event Simulator
 *
 * Dispatches realistic browser events to mimic natural human
 * interaction patterns. Crucial for avoiding Instagram's bot
 * detection heuristics.
 */
(function () {
  'use strict';

  const IU = (window.__IU = window.__IU || {});

  IU.EventSim = {
    /**
     * Simulate a full mouse click sequence (mousedown → mouseup → click).
     * @param {HTMLElement} element
     */
    click(element) {
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const opts = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: rect.left + rect.width / 2 + (Math.random() * 4 - 2),
        clientY: rect.top  + rect.height / 2 + (Math.random() * 4 - 2),
      };

      element.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerId: 1 }));
      element.dispatchEvent(new MouseEvent('mousedown', opts));

      element.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerId: 1 }));
      element.dispatchEvent(new MouseEvent('mouseup', opts));

      element.dispatchEvent(new MouseEvent('click', opts));
    },

    /**
     * Simulate mouse hover (pointer + mouse enter/over events).
     * @param {HTMLElement} element
     */
    hover(element) {
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const opts = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top  + rect.height / 2,
      };

      element.dispatchEvent(new PointerEvent('pointerenter', { ...opts, pointerId: 1, bubbles: false }));
      element.dispatchEvent(new MouseEvent('mouseenter', { ...opts, bubbles: false }));
      element.dispatchEvent(new PointerEvent('pointerover', { ...opts, pointerId: 1 }));
      element.dispatchEvent(new MouseEvent('mouseover', opts));
      element.dispatchEvent(new MouseEvent('mousemove', opts));
    },

    /**
     * Simulate mouse leave (pointer + mouse leave events).
     * @param {HTMLElement} element
     */
    unhover(element) {
      if (!element) return;

      const opts = { bubbles: true, cancelable: true, view: window };

      element.dispatchEvent(new PointerEvent('pointerleave', { ...opts, pointerId: 1, bubbles: false }));
      element.dispatchEvent(new MouseEvent('mouseleave', { ...opts, bubbles: false }));
      element.dispatchEvent(new PointerEvent('pointerout', { ...opts, pointerId: 1 }));
      element.dispatchEvent(new MouseEvent('mouseout', opts));
    },

    /**
     * Scroll an element smoothly into the viewport.
     * @param {HTMLElement} element
     * @returns {Promise<void>}
     */
    async scrollIntoView(element) {
      if (!element) return;
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Wait for smooth scroll to settle
      await IU.EventSim.delay(300, 500);
    },

    /**
     * Wait for a random duration between min and max milliseconds.
     * @param {number} min
     * @param {number} max
     * @returns {Promise<void>}
     */
    delay(min, max) {
      const ms = min + Math.random() * (max - min);
      return new Promise((resolve) => setTimeout(resolve, ms));
    },

    /**
     * Wait for a DOM mutation (element appearing or disappearing).
     * @param {Function} conditionFn — Returns truthy when condition is met
     * @param {number} [timeoutMs=5000] — Max wait time
     * @returns {Promise<boolean>} — True if condition was met, false if timed out
     */
    waitForCondition(conditionFn, timeoutMs = 5000) {
      return new Promise((resolve) => {
        // Check immediately
        if (conditionFn()) {
          resolve(true);
          return;
        }

        const observer = new MutationObserver(() => {
          if (conditionFn()) {
            observer.disconnect();
            clearTimeout(timer);
            resolve(true);
          }
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
        });

        const timer = setTimeout(() => {
          observer.disconnect();
          resolve(false);
        }, timeoutMs);
      });
    },

    /**
     * Wait for a specific element to appear in the DOM.
     * @param {string} selector — CSS selector to wait for
     * @param {number} [timeoutMs=5000]
     * @returns {Promise<HTMLElement|null>}
     */
    async waitForElement(selector, timeoutMs = 5000) {
      const found = await IU.EventSim.waitForCondition(
        () => document.querySelector(selector),
        timeoutMs
      );
      return found ? document.querySelector(selector) : null;
    },
  };

})();
