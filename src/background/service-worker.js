/**
 * InstaUnsend — Service Worker (Background)
 * 
 * The orchestration brain of the extension. Responsibilities:
 * 1. Configure side panel behavior (open on icon click)
 * 2. Enable/disable side panel based on current tab URL
 * 3. Route messages between Side Panel ↔ Content Script
 * 4. Persist default preferences on first install
 */
import { MessageRouter } from './message-router.js';

/* ───────────────────── Side Panel Configuration ─────────────────── */

// Always open the side panel when the extension icon is clicked.
// We will handle "wrong page" state inside the side panel UI itself.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(err => {
  console.error('[InstaUnsend] Failed to set panel behavior:', err);
});

/* ───────────────────── Message Routing ──────────────────────────── */

const router = new MessageRouter();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // All routing is async — return true to keep the channel open
  router
    .route(message, sender)
    .then(() => sendResponse({ ok: true }))
    .catch((err) => sendResponse({ ok: false, error: err.message }));

  return true;
});

/* ───────────────────── Lifecycle Events ─────────────────────────── */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set sensible default preferences on first install
    chrome.storage.local.set({
      iu_preferences: {
        delayMin: 2500,
        delayMax: 6000,
        hoverMin: 300,
        hoverMax: 800,
        maxConsecutiveFails: 5,
      },
    });

    console.log('[InstaUnsend] Extension installed — defaults configured.');
  }

  if (details.reason === 'update') {
    console.log(`[InstaUnsend] Updated to v${chrome.runtime.getManifest().version}`);
  }
});

console.log('[InstaUnsend] Service worker initialized.');
