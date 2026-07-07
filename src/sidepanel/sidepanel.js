/**
 * InstaUnsend — Side Panel Controller (ES Module)
 *
 * Main UI controller for the Chrome side panel. Manages:
 * - Message communication with service worker / content script
 * - UI state machine (idle → indexing → indexed → unsending → complete)
 * - Event binding for all interactive elements
 * - Real-time progress and log updates
 */
import { ProgressBar } from './components/progress-bar.js';
import { FilterPanel } from './components/filter-panel.js';
import { LogViewer }   from './components/log-viewer.js';

/* ──────────────────────── Message Types ─────────────────────────── */
const MSG = Object.freeze({
  START_INDEX:     'IU_START_INDEX',
  START_UNSEND:    'IU_START_UNSEND',
  PAUSE:           'IU_PAUSE',
  RESUME:          'IU_RESUME',
  ABORT:           'IU_ABORT',
  STATUS_REQUEST:  'IU_STATUS_REQUEST',
  CONTENT_READY:   'IU_CONTENT_READY',
  INDEX_PROGRESS:  'IU_INDEX_PROGRESS',
  INDEX_COMPLETE:  'IU_INDEX_COMPLETE',
  UNSEND_PROGRESS: 'IU_UNSEND_PROGRESS',
  UNSEND_COMPLETE: 'IU_UNSEND_COMPLETE',
  STATUS_RESPONSE: 'IU_STATUS_RESPONSE',
  ERROR:           'IU_ERROR',
});

/* ──────────────────────── UI State Machine ──────────────────────── */
const State = Object.freeze({
  IDLE:      'idle',
  INDEXING:  'indexing',
  INDEXED:   'indexed',
  UNSENDING: 'unsending',
  PAUSED:    'paused',
  COMPLETE:  'complete',
  ERROR:     'error',
});

/* ──────────────────────── DOM References ────────────────────────── */
const $ = (id) => document.getElementById(id);

const dom = {
  // Connection
  statusDot:       $('statusDot'),
  statusText:      $('statusText'),

  // Genesis
  indexBadge:       $('indexBadge'),
  statTotal:        $('statTotalMessages'),
  statOldestText:   $('statOldestText'),
  statOldestPhoto:  $('statOldestPhoto'),
  statOldestVoice:  $('statOldestVoice'),
  btnIndex:         $('btnIndex'),

  // Filters
  filterSection:    $('filterSection'),

  // Actions
  btnUnsend:        $('btnUnsend'),
  btnPause:         $('btnPause'),
  btnAbort:         $('btnAbort'),

  // Progress
  progressSection:  $('progressSection'),
  progressPct:      $('progressPct'),
  progressFill:     $('progressFill'),
  progressCurrent:  $('progressCurrent'),
  progressTotal:    $('progressTotal'),
  progressETA:      $('progressETA'),
  progressStatus:   $('progressStatus'),

  // Log
  logEntries:       $('logEntries'),
  btnClearLog:      $('btnClearLog'),
};

/* ──────────────────────── Component Instances ───────────────────── */
const progressBar = new ProgressBar({
  fill:    dom.progressFill,
  pct:     dom.progressPct,
  current: dom.progressCurrent,
  total:   dom.progressTotal,
  eta:     dom.progressETA,
  status:  dom.progressStatus,
});

const filterPanel = new FilterPanel(dom.filterSection);
const logViewer   = new LogViewer(dom.logEntries);

/* ──────────────────────── App State ─────────────────────────────── */
let currentState = State.IDLE;
let isContentReady = false;
let unsendStartTime = null;

/* ──────────────────────── Messaging ─────────────────────────────── */

/** Send a message to the service worker (which forwards to content script) */
function send(type, payload = {}) {
  chrome.runtime.sendMessage({ type, payload }).catch((err) => {
    console.warn('[InstaUnsend Panel] Send failed:', err.message);
  });
}

/** Listen for incoming messages from the service worker */
chrome.runtime.onMessage.addListener((message) => {
  if (!message?.type) return;

  const { type, payload } = message;

  switch (type) {
    case MSG.CONTENT_READY:
      handleContentReady();
      break;

    case MSG.INDEX_PROGRESS:
      handleIndexProgress(payload);
      break;

    case MSG.INDEX_COMPLETE:
      handleIndexComplete(payload);
      break;

    case MSG.UNSEND_PROGRESS:
      handleUnsendProgress(payload);
      break;

    case MSG.UNSEND_COMPLETE:
      handleUnsendComplete(payload);
      break;

    case MSG.STATUS_RESPONSE:
      handleStatusResponse(payload);
      break;

    case MSG.ERROR:
      handleError(payload);
      break;
  }
});

/* ──────────────────────── Message Handlers ──────────────────────── */

function handleContentReady() {
  isContentReady = true;
  setConnected(true);
  logViewer.add('info', 'Connected to Instagram DM page.');
  // Re-evaluate state so the Index button gets enabled
  setState(currentState);
}

function handleIndexProgress(payload) {
  const { scrollPercent, messagesFound, currentDate } = payload || {};
  setState(State.INDEXING);
  progressBar.update(scrollPercent || 0, 100, `Indexing… ${messagesFound || 0} messages found`);

  if (currentDate) {
    dom.statTotal.textContent = messagesFound || '—';
  }
}

function handleIndexComplete(payload) {
  const { totalMessages, oldestText, oldestPhoto, oldestVoice, ownMessages } = payload || {};

  setState(State.INDEXED);

  // Update stat cards
  dom.statTotal.textContent       = totalMessages ?? '—';
  dom.statOldestText.textContent  = formatDate(oldestText);
  dom.statOldestPhoto.textContent = formatDate(oldestPhoto);
  dom.statOldestVoice.textContent = formatDate(oldestVoice);

  // Update badge
  dom.indexBadge.textContent = 'Indexed';
  dom.indexBadge.classList.remove('indexing');
  dom.indexBadge.classList.add('indexed');

  logViewer.add('success', `Indexing complete: ${totalMessages} messages found (${ownMessages ?? '?'} yours).`);
}

function handleUnsendProgress(payload) {
  const { current, total, lastUnsent, status } = payload || {};

  progressBar.update(current, total, status || `Unsending message ${current} of ${total}…`);

  // Calculate ETA
  if (unsendStartTime && current > 0) {
    const elapsed = Date.now() - unsendStartTime;
    const perMsg  = elapsed / current;
    const remaining = (total - current) * perMsg;
    dom.progressETA.textContent = `ETA: ${formatDuration(remaining)}`;
  }

  if (lastUnsent) {
    const preview = lastUnsent.length > 50 ? lastUnsent.slice(0, 50) + '…' : lastUnsent;
    logViewer.add('info', `Unsent: "${preview}"`);
  }
}

function handleUnsendComplete(payload) {
  const { totalUnsent, errors } = payload || {};
  setState(State.COMPLETE);
  progressBar.update(totalUnsent, totalUnsent, 'Complete!');

  logViewer.add('success', `Done! ${totalUnsent} messages unsent.`);
  if (errors > 0) {
    logViewer.add('warn', `${errors} message(s) failed to unsend.`);
  }
}

function handleStatusResponse(payload) {
  if (payload?.state) {
    setState(payload.state);
  }
  if (payload?.ready) {
    handleContentReady();
  }
}

function handleError(payload) {
  const { code, message, recoverable } = payload || {};
  logViewer.add('error', message || `Error: ${code}`);

  if (!recoverable) {
    setState(State.ERROR);
  }
}

/* ──────────────────────── State Management ──────────────────────── */

function setState(newState) {
  currentState = newState;

  // Reset all button states
  dom.btnIndex.disabled  = true;
  dom.btnUnsend.disabled = true;
  dom.btnPause.disabled  = true;
  dom.btnAbort.disabled  = true;
  dom.filterSection.classList.add('iu-disabled');
  dom.progressSection.classList.add('iu-hidden');

  switch (newState) {
    case State.IDLE:
      dom.btnIndex.disabled = !isContentReady;
      break;

    case State.INDEXING:
      dom.progressSection.classList.remove('iu-hidden');
      dom.indexBadge.textContent = 'Indexing…';
      dom.indexBadge.classList.add('indexing');
      dom.indexBadge.classList.remove('indexed');
      dom.btnAbort.disabled = false;
      break;

    case State.INDEXED:
      dom.btnIndex.disabled = false;
      dom.btnUnsend.disabled = false;
      dom.filterSection.classList.remove('iu-disabled');
      break;

    case State.UNSENDING:
      dom.progressSection.classList.remove('iu-hidden');
      dom.btnPause.disabled = false;
      dom.btnAbort.disabled = false;
      dom.btnPause.querySelector('span').textContent = '⏸️ Pause';
      break;

    case State.PAUSED:
      dom.progressSection.classList.remove('iu-hidden');
      dom.btnPause.disabled = false;
      dom.btnAbort.disabled = false;
      dom.btnPause.querySelector('span').textContent = '▶️ Resume';
      logViewer.add('warn', 'Operation paused.');
      break;

    case State.COMPLETE:
      dom.btnIndex.disabled  = false;
      dom.btnUnsend.disabled = false;
      dom.filterSection.classList.remove('iu-disabled');
      dom.progressSection.classList.remove('iu-hidden');
      break;

    case State.ERROR:
      dom.btnIndex.disabled = !isContentReady;
      dom.progressSection.classList.remove('iu-hidden');
      break;
  }
}

/* ──────────────────────── Event Handlers ────────────────────────── */

dom.btnIndex.addEventListener('click', () => {
  setState(State.INDEXING);
  progressBar.reset();
  logViewer.add('info', 'Starting chat indexing…');
  send(MSG.START_INDEX);
});

dom.btnUnsend.addEventListener('click', () => {
  const filters = filterPanel.getFilters();

  // Validate: at least one media type selected
  if (filters.mediaTypes.length === 0) {
    logViewer.add('warn', 'Select at least one message type to unsend.');
    return;
  }

  // Confirm nuclear option
  if (filters.nuclear && !confirm('☢️ NUCLEAR OPTION\n\nThis will unsend ALL your messages in this chat.\n\nAre you sure?')) {
    return;
  }

  setState(State.UNSENDING);
  unsendStartTime = Date.now();
  progressBar.reset();
  logViewer.add('info', `Starting unsend with filters: ${filters.mediaTypes.join(', ')}`);

  send(MSG.START_UNSEND, filters);
});

dom.btnPause.addEventListener('click', () => {
  if (currentState === State.UNSENDING) {
    send(MSG.PAUSE);
    setState(State.PAUSED);
  } else if (currentState === State.PAUSED) {
    send(MSG.RESUME);
    setState(State.UNSENDING);
    logViewer.add('info', 'Operation resumed.');
  }
});

dom.btnAbort.addEventListener('click', () => {
  if (confirm('Abort the current operation? Progress will be lost.')) {
    send(MSG.ABORT);
    setState(State.INDEXED);
    logViewer.add('warn', 'Operation aborted by user.');
  }
});

dom.btnClearLog.addEventListener('click', () => {
  logViewer.clear();
});

/* ──────────────────────── Connection Status ─────────────────────── */

function setConnected(connected) {
  dom.statusDot.classList.toggle('connected', connected);
  dom.statusDot.classList.toggle('error', !connected);
  dom.statusText.textContent = connected ? 'Connected' : 'Disconnected';
}

/* ──────────────────────── Utilities ─────────────────────────────── */

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatDuration(ms) {
  if (!ms || ms < 0) return '—';
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remSecs}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

/* ──────────────────────── Initialization ────────────────────────── */

setState(State.IDLE);
logViewer.add('info', 'InstaUnsend panel ready. Waiting for Instagram DM page…');

// Ask the content script if it's already loaded
send(MSG.STATUS_REQUEST);

// Periodic connection check — handles service worker restarts
setInterval(() => {
  if (!isContentReady) {
    send(MSG.STATUS_REQUEST);
  }
}, 5000);
