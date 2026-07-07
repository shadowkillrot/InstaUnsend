/**
 * InstaUnsend — Unsend Engine (Human Mimicry Engine)
 *
 * The core execution loop that performs the actual message unsending.
 * Implements human-like interaction patterns with randomized delays,
 * exponential backoff on failures, and a circuit breaker for safety.
 *
 * Execution flow per message:
 * 1. Scroll message into viewport
 * 2. Hover over message to reveal action buttons
 * 3. Click "More options" button
 * 4. Wait random 300-800ms
 * 5. Click "Unsend" menu item
 * 6. Handle confirmation dialog (if shown)
 * 7. Wait for DOM to confirm message removal
 * 8. Apply master delay (2.5-6s) before next message
 *
 * Safety:
 * - Exponential backoff on failures (15s → 30s → 60s → 120s)
 * - Circuit breaker after 5 consecutive failures → auto-pause
 * - Pause/Resume/Abort support at every step
 */
(function () {
  'use strict';

  const IU = (window.__IU = window.__IU || {});

  /** Internal state */
  let _state = 'idle'; // idle | running | paused | aborted
  let _consecutiveFailures = 0;
  let _pauseResolve = null;

  IU.UnsendEngine = {
    /** Running statistics */
    stats: {
      total: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
    },

    /**
     * Execute the unsend operation on a filtered queue of messages.
     *
     * @param {Array} queue — Messages to unsend (from index + filters)
     * @param {Function} onProgress — Callback: ({ current, total, lastUnsent, status })
     * @returns {Promise<{ totalUnsent: number, errors: number }>}
     */
    async execute(queue, onProgress) {
      _state = 'running';
      _consecutiveFailures = 0;

      this.stats = {
        total:     queue.length,
        processed: 0,
        succeeded: 0,
        failed:    0,
      };

      IU.log.info(`Unsend engine starting — ${queue.length} messages in queue.`);

      for (let i = 0; i < queue.length; i++) {
        // ── Check for abort ──
        if (_state === 'aborted') {
          IU.log.warn('Unsend operation aborted.');
          break;
        }

        // ── Check for pause ──
        if (_state === 'paused') {
          IU.log.info('Unsend operation paused. Waiting for resume…');
          await this._waitForResume();
          if (_state === 'aborted') break;
        }

        const msg = queue[i];

        // ── Attempt to unsend this message ──
        const success = await this._unsendSingleMessage(msg);

        this.stats.processed++;
        if (success) {
          this.stats.succeeded++;
          _consecutiveFailures = 0;
        } else {
          this.stats.failed++;
          _consecutiveFailures++;
        }

        // ── Report progress ──
        if (onProgress) {
          onProgress({
            current:    this.stats.processed,
            total:      this.stats.total,
            lastUnsent: success ? (msg.text || `[${msg.type}]`) : null,
            status:     success
              ? `Unsent message ${this.stats.processed} of ${this.stats.total}`
              : `Failed on message ${this.stats.processed} — retrying…`,
          });
        }

        // ── Circuit breaker ──
        if (_consecutiveFailures >= IU.Delays.MAX_CONSECUTIVE_FAILS) {
          IU.log.error(`Circuit breaker: ${_consecutiveFailures} consecutive failures. Auto-pausing.`);
          _state = 'paused';

          if (onProgress) {
            onProgress({
              current: this.stats.processed,
              total:   this.stats.total,
              lastUnsent: null,
              status: `⚠️ Auto-paused after ${_consecutiveFailures} failures. Check the page and resume.`,
            });
          }

          await this._waitForResume();
          if (_state === 'aborted') break;

          _consecutiveFailures = 0;
        }

        // ── Master delay between messages ──
        if (i < queue.length - 1 && _state === 'running') {
          await IU.EventSim.delay(IU.Delays.MASTER_MIN, IU.Delays.MASTER_MAX);
        }
      }

      _state = 'idle';

      IU.log.success(
        `Unsend complete: ${this.stats.succeeded} unsent, ${this.stats.failed} failed out of ${this.stats.total}.`
      );

      return {
        totalUnsent: this.stats.succeeded,
        errors:      this.stats.failed,
      };
    },

    /** Pause the current operation */
    pause() {
      if (_state === 'running') {
        _state = 'paused';
      }
    },

    /** Resume a paused operation */
    resume() {
      if (_state === 'paused' && _pauseResolve) {
        _state = 'running';
        _pauseResolve();
        _pauseResolve = null;
      }
    },

    /** Abort the current operation */
    abort() {
      _state = 'aborted';
      // Also release any pending pause
      if (_pauseResolve) {
        _pauseResolve();
        _pauseResolve = null;
      }
    },

    /** Get current engine state */
    getState() {
      return _state;
    },

    /* ══════════════════════ PRIVATE METHODS ══════════════════════ */

    /**
     * Unsend a single message using the Human Mimicry protocol.
     * @param {{ element: HTMLElement, type: string, text: string }} msg
     * @returns {Promise<boolean>} — True if successfully unsent
     */
    async _unsendSingleMessage(msg) {
      const { element } = msg;

      try {
        // Step 1: Scroll the message into view
        await IU.EventSim.scrollIntoView(element);

        // Step 2: Hover over message to reveal hidden action buttons
        IU.EventSim.hover(element);
        await IU.EventSim.delay(200, 400);

        // Step 3: Find and click "More options" button
        const moreBtn = IU.Selectors.moreOptionsButton(element);
        if (!moreBtn) {
          IU.log.warn('Could not find "More options" button — skipping message.');
          return false;
        }

        IU.EventSim.click(moreBtn);

        // Step 4: Wait for the context menu to appear
        await IU.EventSim.delay(IU.Delays.HOVER_MIN, IU.Delays.HOVER_MAX);

        // Step 5: Find and click "Unsend" menu item
        const unsendItem = IU.Selectors.unsendMenuItem();
        if (!unsendItem) {
          IU.log.warn('Could not find "Unsend" option in menu — skipping message.');
          // Close the menu by clicking elsewhere
          document.body.click();
          await IU.EventSim.delay(200, 300);
          return false;
        }

        IU.EventSim.click(unsendItem);

        // Step 6: Handle potential confirmation dialog
        await IU.EventSim.delay(300, 500);
        const confirmBtn = IU.Selectors.unsendConfirmButton();
        if (confirmBtn) {
          IU.EventSim.click(confirmBtn);
        }

        // Step 7: Wait for DOM mutation confirming removal
        const removed = await IU.EventSim.waitForCondition(() => {
          // Check if the element is no longer in the DOM or is hidden
          return !document.contains(element) ||
                 element.offsetParent === null ||
                 element.style.display === 'none';
        }, IU.Delays.MUTATION_TIMEOUT);

        if (!removed) {
          IU.log.warn('Message was not confirmed removed from DOM — may have failed.');
          // Apply exponential backoff
          const backoff = Math.min(
            IU.Delays.BACKOFF_BASE * Math.pow(2, _consecutiveFailures),
            IU.Delays.BACKOFF_MAX
          );
          IU.log.info(`Backing off for ${Math.round(backoff / 1000)}s…`);
          await IU.EventSim.delay(backoff, backoff + 1000);
          return false;
        }

        return true;

      } catch (err) {
        IU.log.error(`Error unsending message: ${err.message}`);
        // Apply backoff on unexpected errors
        const backoff = Math.min(
          IU.Delays.BACKOFF_BASE * Math.pow(2, _consecutiveFailures),
          IU.Delays.BACKOFF_MAX
        );
        await IU.EventSim.delay(backoff, backoff + 1000);
        return false;
      }
    },

    /**
     * Wait until the resume() method is called.
     * @returns {Promise<void>}
     */
    _waitForResume() {
      return new Promise((resolve) => {
        _pauseResolve = resolve;
      });
    },
  };

})();
