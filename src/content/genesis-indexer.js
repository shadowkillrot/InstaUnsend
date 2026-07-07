/**
 * InstaUnsend — Genesis Deep Indexing Engine
 *
 * Feature 1: Automated scroll-to-beginning + message cataloging.
 *
 * Algorithm:
 * 1. Find the scrollable chat container
 * 2. Repeatedly scroll upward to trigger lazy-loading of older messages
 * 3. Use MutationObserver to detect newly loaded message batches
 * 4. Classify each message (type, timestamp, authorship)
 * 5. Track oldest date per media type for the dashboard
 * 6. Report progress as it goes
 * 7. Complete when no new content loads after consecutive scroll attempts
 */
(function () {
  'use strict';

  const IU = (window.__IU = window.__IU || {});

  /** Internal state for the indexing process */
  let _aborted = false;

  IU.GenesisIndexer = {
    /** @type {{ element: HTMLElement, type: string, text: string, isOwn: boolean, timestamp: string|null }[]} */
    indexedMessages: [],

    /** Whether indexing has been completed */
    isIndexed: false,

    /**
     * Start the deep indexing process.
     * Scrolls to the absolute beginning of the chat and catalogs all messages.
     *
     * @param {Function} onProgress — Callback: ({ scrollPercent, messagesFound, currentDate })
     * @returns {Promise<Object>} — Index summary
     */
    async start(onProgress) {
      _aborted = false;
      this.indexedMessages = [];
      this.isIndexed = false;

      // Wait for the chat container to appear (React may not have hydrated yet)
      let container = null;
      for (let attempt = 0; attempt < 10; attempt++) {
        container = IU.Selectors.chatContainer();
        if (container) break;
        IU.log.info(`Waiting for chat container to load… (attempt ${attempt + 1}/10)`);
        await IU.EventSim.delay(1000, 1500);
      }

      if (!container) {
        throw new Error('Could not find the chat message area. Make sure a DM conversation is open and fully loaded.');
      }

      IU.log.info(`Genesis indexer starting — found container (${container.tagName}, scrollHeight: ${container.scrollHeight}px).`);
      IU.log.info('Scrolling to beginning of chat…');

      // ── Phase 1: Scroll to the very top ────────────────────────
      await this._scrollToTop(container, onProgress);

      if (_aborted) {
        IU.log.warn('Indexing aborted by user.');
        return null;
      }

      // ── Phase 2: Catalog all visible messages ──────────────────
      IU.log.info('Reached top of chat. Cataloging messages…');
      this.indexedMessages = this._catalogMessages(container);

      // ── Phase 3: Extract timestamps ────────────────────────────
      this._extractTimestamps(container);

      // ── Phase 4: Build summary ─────────────────────────────────
      const summary = this._buildSummary();
      this.isIndexed = true;

      IU.log.success(`Indexing complete: ${summary.totalMessages} total, ${summary.ownMessages} yours.`);

      return summary;
    },

    /**
     * Abort the current indexing operation.
     */
    abort() {
      _aborted = true;
    },

    /* ══════════════════════ PRIVATE METHODS ══════════════════════ */

    /**
     * Scroll the chat container to the absolute top, waiting for
     * lazy-loaded content between each scroll step.
     */
    async _scrollToTop(container, onProgress) {
      const MAX_STALE_ATTEMPTS = 5;
      const SCROLL_INTERVAL = IU.Delays.SCROLL_STEP_INTERVAL;
      const SETTLE_TIME     = IU.Delays.SCROLL_SETTLE;
      const TIMEOUT         = IU.Delays.INDEX_TIMEOUT;

      let staleAttempts = 0;
      let lastScrollHeight = container.scrollHeight;
      let lastMessageCount = 0;
      const startTime = Date.now();

      while (!_aborted) {
        // Timeout safety
        if (Date.now() - startTime > TIMEOUT) {
          IU.log.warn('Index timeout reached (10 min). Proceeding with partial results.');
          break;
        }

        // Scroll to the oldest currently loaded message to trigger lazy loading
        const rows = IU.Selectors.messageRows(container);
        if (rows.length > 0) {
          // rows[0] is typically the oldest message currently in the DOM
          rows[0].scrollIntoView({ behavior: 'smooth', block: 'end' });
        } else {
          container.scrollTop = 0; // Fallback
        }
        
        // Dispatch a scroll event just in case React needs it
        container.dispatchEvent(new Event('scroll', { bubbles: true }));

        // Wait for React to hydrate new content
        await IU.EventSim.delay(SETTLE_TIME, SETTLE_TIME + 500);

        const currentScrollHeight = container.scrollHeight;
        const currentMessageCount = IU.Selectors.messageRows(container).length;

        // Report progress
        if (onProgress) {
          const totalEstimate = Math.max(currentScrollHeight, 1);
          const scrollPercent = Math.min(
            Math.round(((currentScrollHeight - container.scrollTop) / totalEstimate) * 100),
            99
          );
          onProgress({
            scrollPercent,
            messagesFound: currentMessageCount,
            currentDate: null,
          });
        }

        // Check if new content was loaded
        if (currentScrollHeight === lastScrollHeight && currentMessageCount === lastMessageCount) {
          staleAttempts++;
          if (staleAttempts >= MAX_STALE_ATTEMPTS) {
            IU.log.info(`No new content after ${MAX_STALE_ATTEMPTS} attempts. Reached the beginning.`);
            break;
          }
        } else {
          staleAttempts = 0;
          lastScrollHeight = currentScrollHeight;
          lastMessageCount = currentMessageCount;
        }

        // Small delay before next scroll attempt
        await IU.EventSim.delay(SCROLL_INTERVAL, SCROLL_INTERVAL + 200);
      }
    },

    /**
     * Catalog all message rows in the container using the classifier.
     * @param {HTMLElement} container
     * @returns {Array}
     */
    _catalogMessages(container) {
      return IU.Classifier.classifyAll(container);
    },

    /**
     * Extract and associate timestamps with indexed messages.
     * Instagram displays timestamps as date dividers between message groups.
     * We walk through the DOM sequentially and assign the nearest timestamp
     * to each message.
     */
    _extractTimestamps(container) {
      const allElements = container.querySelectorAll('*');
      // Default to right now, because recent messages at the bottom might not have a date heading above them
      let currentTimestamp = new Date().toISOString();

      // Build a set of our message elements for quick lookup
      const messageElements = new Set(this.indexedMessages.map(m => m.element));

      for (const el of allElements) {
        // Check if this is a timestamp element
        const timeEl = el.tagName === 'TIME' ? el : el.querySelector?.('time[datetime]');
        if (timeEl?.getAttribute('datetime')) {
          currentTimestamp = timeEl.getAttribute('datetime');
          continue;
        }

        // Check for date heading text (e.g., "January 15, 2024" or "Sunday 1:48 PM")
        if (el.getAttribute?.('role') === 'heading') {
          const parsed = this._parseDateHeading(el.textContent);
          if (parsed) {
            currentTimestamp = parsed;
            continue;
          }
        }

        // Assign timestamp to any matching message element
        if (messageElements.has(el)) {
          const msg = this.indexedMessages.find(m => m.element === el);
          if (msg) {
            msg.timestamp = currentTimestamp;
          }
        }
      }
    },

    /**
     * Attempt to parse a date heading string like "January 15, 2024" or "Sunday".
     * @param {string} text
     * @returns {string|null} — ISO date string or null
     */
    _parseDateHeading(text) {
      if (!text) return null;
      const cleaned = text.trim();
      
      // Try native parse first (handles explicit dates like "January 15, 2024")
      const date = new Date(cleaned);
      if (!isNaN(date.getTime()) && date.getFullYear() > 2000) {
        return date.toISOString();
      }
      
      // Handle relative Instagram dates ("Sunday 1:48 PM", "Yesterday")
      // We assign them to the current date/time since they are recent.
      const lower = cleaned.toLowerCase();
      const relativeKeywords = ['today', 'yesterday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      
      if (relativeKeywords.some(kw => lower.includes(kw))) {
        return new Date().toISOString();
      }

      // If we completely fail to parse, default to right now so it doesn't break filters
      return new Date().toISOString();
    },

    /**
     * Build the summary report from indexed messages.
     * @returns {Object}
     */
    _buildSummary() {
      const own = this.indexedMessages.filter(m => m.isOwn);
      const counts = IU.Classifier.summarize(this.indexedMessages);

      // Find oldest date per type (from own messages)
      const oldestByType = {};
      for (const type of Object.values(IU.MediaType)) {
        const ofType = own
          .filter(m => m.type === type && m.timestamp)
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        oldestByType[type] = ofType.length > 0 ? ofType[0].timestamp : null;
      }

      // Overall date range
      const withDates = this.indexedMessages.filter(m => m.timestamp);
      const allDates  = withDates.map(m => new Date(m.timestamp)).sort((a, b) => a - b);

      return {
        totalMessages: this.indexedMessages.length,
        ownMessages:   own.length,
        counts,
        oldestText:    oldestByType[IU.MediaType.TEXT],
        oldestPhoto:   oldestByType[IU.MediaType.PHOTO],
        oldestVoice:   oldestByType[IU.MediaType.VOICE],
        oldestReel:    oldestByType[IU.MediaType.REEL],
        dateRange: {
          start: allDates.length > 0 ? allDates[0].toISOString() : null,
          end:   allDates.length > 0 ? allDates[allDates.length - 1].toISOString() : null,
        },
      };
    },
  };

})();
