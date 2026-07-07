/**
 * InstaUnsend — Message Router (Service Worker Module)
 * 
 * Central routing hub: forwards messages between the Side Panel UI
 * and the Content Script running on the Instagram page.
 * 
 * Direction:
 *   Side Panel  →  Service Worker  →  Content Script   (commands)
 *   Content Script  →  Service Worker  →  Side Panel    (progress/data)
 */

/* ──────────────────────── Message Type Constants ────────────────── */
export const MSG = Object.freeze({
  // Panel → Content Script
  START_INDEX:     'IU_START_INDEX',
  START_UNSEND:    'IU_START_UNSEND',
  PAUSE:           'IU_PAUSE',
  RESUME:          'IU_RESUME',
  ABORT:           'IU_ABORT',
  STATUS_REQUEST:  'IU_STATUS_REQUEST',

  // Content Script → Panel
  CONTENT_READY:   'IU_CONTENT_READY',
  INDEX_PROGRESS:  'IU_INDEX_PROGRESS',
  INDEX_COMPLETE:  'IU_INDEX_COMPLETE',
  UNSEND_PROGRESS: 'IU_UNSEND_PROGRESS',
  UNSEND_COMPLETE: 'IU_UNSEND_COMPLETE',
  STATUS_RESPONSE: 'IU_STATUS_RESPONSE',
  ERROR:           'IU_ERROR',
});

/* ──────────────────────── Routing Sets ──────────────────────────── */

/** Messages originating from the Side Panel → forward to Content Script */
const PANEL_TO_CONTENT = new Set([
  MSG.START_INDEX, MSG.START_UNSEND,
  MSG.PAUSE, MSG.RESUME, MSG.ABORT,
  MSG.STATUS_REQUEST,
]);

/** Messages originating from the Content Script → forward to Side Panel */
const CONTENT_TO_PANEL = new Set([
  MSG.CONTENT_READY, MSG.INDEX_PROGRESS, MSG.INDEX_COMPLETE,
  MSG.UNSEND_PROGRESS, MSG.UNSEND_COMPLETE,
  MSG.STATUS_RESPONSE, MSG.ERROR,
]);

/* ──────────────────────── Router Class ──────────────────────────── */

export class MessageRouter {
  constructor() {
    /** @type {number|null} Tab ID where content script is active */
    this._contentTabId = null;
  }

  /**
   * Route an incoming message to its destination.
   * Called by the service worker's onMessage listener.
   *
   * @param {{ type: string, payload?: any }} message
   * @param {chrome.runtime.MessageSender} sender
   */
  async route(message, sender) {
    if (!message?.type) return;

    const { type, payload } = message;

    // ── Message from CONTENT SCRIPT (sender.tab is populated) ──
    if (sender.tab) {
      this._contentTabId = sender.tab.id;

      if (CONTENT_TO_PANEL.has(type)) {
        try {
          await chrome.runtime.sendMessage({ type, payload });
        } catch {
          // Side panel may not be open — safe to ignore
        }
      }

      this._persistIfNeeded(type, payload);
      return;
    }

    // ── Message from SIDE PANEL (no sender.tab) ──
    if (PANEL_TO_CONTENT.has(type)) {
      await this._forwardToContent(type, payload);
    }
  }

  /* ────────────────────── Private Helpers ────────────────────────── */

  /**
   * Attempt to forward a message to the content script tab.
   */
  async _forwardToContent(type, payload) {
    // If we don't have a known content tab, try finding one
    if (!this._contentTabId) {
      this._contentTabId = await this._findInstagramTab();
    }

    if (!this._contentTabId) {
      this._emitError(
        'CONTENT_NOT_FOUND',
        'No active Instagram DM tab found. Open a conversation in instagram.com/direct first.'
      );
      return;
    }

    try {
      await chrome.tabs.sendMessage(this._contentTabId, { type, payload });
    } catch {
      this._contentTabId = null;
      this._emitError(
        'CONTENT_NOT_READY',
        'Content script is not responding. Refresh the Instagram page and try again.'
      );
    }
  }

  /**
   * Try to locate an open Instagram Direct tab.
   * @returns {Promise<number|null>}
   */
  async _findInstagramTab() {
    try {
      const tabs = await chrome.tabs.query({
        url: 'https://www.instagram.com/direct/*',
      });
      return tabs.length > 0 ? tabs[0].id : null;
    } catch {
      return null;
    }
  }

  /**
   * Send an error message back to the side panel.
   */
  _emitError(code, message) {
    chrome.runtime.sendMessage({
      type: MSG.ERROR,
      payload: { code, message, recoverable: true },
    }).catch(() => { /* panel might be closed */ });
  }

  /**
   * Persist significant operation events to chrome.storage.local
   * so state survives service worker restarts.
   */
  _persistIfNeeded(type, payload) {
    const PERSIST_TYPES = new Set([
      MSG.INDEX_COMPLETE,
      MSG.UNSEND_COMPLETE,
      MSG.ERROR,
    ]);

    if (PERSIST_TYPES.has(type)) {
      chrome.storage.local.set({
        [`iu_last_${type}`]: { payload, timestamp: Date.now() },
      });
    }
  }
}
