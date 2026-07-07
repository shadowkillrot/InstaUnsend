/**
 * InstaUnsend — Content Script Entry Point
 *
 * This file is loaded LAST in the content script chain.
 * It wires everything together:
 * 1. Listens for commands from the service worker
 * 2. Dispatches to the appropriate module (indexer, engine, etc.)
 * 3. Sends progress/results back to the service worker → side panel
 *
 * Dependencies (loaded before this via manifest.json):
 *   constants.js → logger.js → dom-selectors.js → event-simulator.js
 *   → message-classifier.js → date-filter.js → keyword-scanner.js
 *   → genesis-indexer.js → unsend-engine.js
 */
(function () {
  'use strict';

  const IU  = window.__IU;
  const MSG = IU.MSG;

  /* ────────────────────── Messaging Helpers ──────────────────────── */

  /** Send a message to the service worker (which forwards to side panel) */
  function emit(type, payload = {}) {
    chrome.runtime.sendMessage({ type, payload }).catch(() => {
      // Service worker might be asleep or panel closed — safe to ignore
    });
  }

  /* ────────────────────── Command Handlers ──────────────────────── */

  /**
   * Handle: START_INDEX
   * Runs the Genesis Deep Indexing Engine.
   */
  async function handleStartIndex() {
    IU.log.info('Received START_INDEX command.');

    try {
      const summary = await IU.GenesisIndexer.start((progress) => {
        emit(MSG.INDEX_PROGRESS, progress);
      });

      if (summary) {
        emit(MSG.INDEX_COMPLETE, summary);
      }
    } catch (err) {
      IU.log.error('Indexing failed:', err.message);
      emit(MSG.ERROR, {
        code: 'INDEX_FAILED',
        message: err.message,
        recoverable: true,
      });
    }
  }

  /**
   * Handle: START_UNSEND
   * Applies filters to the indexed messages and runs the unsend engine.
   *
   * @param {{ mediaTypes: string[], dateRange: { start, end }, keyword: string, isRegex: boolean, nuclear: boolean }} filters
   */
  async function handleStartUnsend(filters) {
    IU.log.info('Received START_UNSEND command.', filters);

    if (!IU.GenesisIndexer.isIndexed || IU.GenesisIndexer.indexedMessages.length === 0) {
      emit(MSG.ERROR, {
        code: 'NOT_INDEXED',
        message: 'Chat has not been indexed yet. Run "Index Chat" first.',
        recoverable: true,
      });
      return;
    }

    try {
      // ── Step 1: Start with all OWN messages ──
      let queue = IU.GenesisIndexer.indexedMessages.filter(m => m.isOwn);
      IU.log.info(`Starting with ${queue.length} own messages.`);

      // ── Step 2: Filter by media type ──
      if (filters.mediaTypes && filters.mediaTypes.length > 0 && !filters.nuclear) {
        const allowedTypes = new Set(filters.mediaTypes);
        queue = queue.filter(m => allowedTypes.has(m.type));
        IU.log.info(`After media filter: ${queue.length} messages.`);
      }

      // ── Step 3: Filter by date range ──
      if (filters.dateRange?.start || filters.dateRange?.end) {
        queue = IU.DateFilter.filter(queue, filters.dateRange.start, filters.dateRange.end);
        IU.log.info(`After date filter: ${queue.length} messages.`);
      }

      // ── Step 4: Filter by keyword ──
      if (filters.keyword) {
        queue = IU.KeywordScanner.filter(queue, filters.keyword, filters.isRegex);
        IU.log.info(`After keyword filter: ${queue.length} messages.`);
      }

      // ── Validate queue ──
      if (queue.length === 0) {
        emit(MSG.ERROR, {
          code: 'EMPTY_QUEUE',
          message: 'No messages match your filters. Adjust your criteria and try again.',
          recoverable: true,
        });
        return;
      }

      IU.log.info(`Final unsend queue: ${queue.length} messages.`);

      // ── Step 5: Execute unsend ──
      // Process messages from bottom to top (newest first) to avoid
      // DOM position shifts that would occur when deleting from the top
      queue.reverse();

      const result = await IU.UnsendEngine.execute(queue, (progress) => {
        emit(MSG.UNSEND_PROGRESS, progress);
      });

      emit(MSG.UNSEND_COMPLETE, result);

    } catch (err) {
      IU.log.error('Unsend operation failed:', err.message);
      emit(MSG.ERROR, {
        code: 'UNSEND_FAILED',
        message: err.message,
        recoverable: true,
      });
    }
  }

  /* ────────────────────── Message Listener ───────────────────────── */

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message?.type) return;

    const { type, payload } = message;

    switch (type) {
      case MSG.START_INDEX:
        handleStartIndex();
        break;

      case MSG.START_UNSEND:
        handleStartUnsend(payload);
        break;

      case MSG.PAUSE:
        IU.UnsendEngine.pause();
        IU.log.info('Pause command received.');
        break;

      case MSG.RESUME:
        IU.UnsendEngine.resume();
        IU.log.info('Resume command received.');
        break;

      case MSG.ABORT:
        IU.GenesisIndexer.abort();
        IU.UnsendEngine.abort();
        IU.log.warn('Abort command received.');
        break;

      case MSG.STATUS_REQUEST:
        emit(MSG.STATUS_RESPONSE, {
          ready: true,
          state: IU.UnsendEngine.getState(),
          isIndexed: IU.GenesisIndexer.isIndexed,
          messageCount: IU.GenesisIndexer.indexedMessages.length,
        });
        break;
    }

    sendResponse({ ok: true });
    return true;
  });

  /* ────────────────────── Initialization ─────────────────────────── */

  IU.log.success('Content script loaded on Instagram Direct.');

  // Notify the service worker / side panel that we're ready
  emit(MSG.CONTENT_READY);

})();
