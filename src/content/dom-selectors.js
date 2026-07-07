/**
 * InstaUnsend — DOM Selectors Registry
 *
 * Centralized, maintainable registry of all Instagram DOM selectors.
 * Uses structural/ARIA-based selectors for resilience against
 * React class name obfuscation.
 *
 * ⚠️  These selectors are best-effort based on observed Instagram
 *     DOM patterns. They WILL need live validation and updates as
 *     Instagram evolves its markup.
 */
(function () {
  'use strict';

  const IU = (window.__IU = window.__IU || {});

  IU.Selectors = {
    /* ─── Chat Container ──────────────────────────────────────── */

    /**
     * The scrollable container holding all messages in the active thread.
     * Instagram typically wraps messages in a role="grid" or a deeply
     * nested scrollable div.
     * @returns {HTMLElement|null}
     */
    chatContainer() {
      // The most reliable anchor is the message input box.
      // The actual chat container is in the same structural block as the input box.
      const inputBox = document.querySelector('textarea, [contenteditable="true"][role="textbox"]');
      
      let searchRoot = document;
      if (inputBox) {
        // Find the closest major wrapper (usually <section> or a major flex column)
        // that contains both the chat and the input box.
        searchRoot = inputBox.closest('section, main, [role="main"]') || document;
      }

      // Attempt 1: role="grid" inside the chat section
      const grid = searchRoot.querySelector('[role="grid"]');
      if (grid && grid.scrollHeight > 200) { 
        IU.log.debug('chatContainer: found via role=grid inside chat section'); 
        return grid; 
      }

      // Attempt 2: role="list" inside the chat section
      const list = searchRoot.querySelector('[role="list"]');
      if (list && list.scrollHeight > 200) { 
        IU.log.debug('chatContainer: found via role=list inside chat section'); 
        return list; 
      }

      // Attempt 3: Find scrollable children using computed styles
      // We look for the tallest scrollable div within the search root.
      const allDivs = searchRoot.querySelectorAll('div');
      let bestDiv = null;
      let maxScore = 0;

      for (const div of allDivs) {
        // Skip tiny divs to save performance
        if (div.clientHeight < 200) continue;

        const computed = window.getComputedStyle(div);
        const overflowY = computed.overflowY;
        
        if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
          // Score based on height and if it contains message-like text
          let score = div.scrollHeight;
          
          // Bonus if it contains text direction nodes (common in IG messages)
          if (div.querySelector('div[dir="auto"]')) {
            score += 10000;
          }

          if (score > maxScore) {
            maxScore = score;
            bestDiv = div;
          }
        }
      }

      if (bestDiv) {
        IU.log.debug('chatContainer: found via computed overflow scoring');
        return bestDiv;
      }

      // Attempt 4: tabindex fallback
      const tabIndexed = searchRoot.querySelector('div[tabindex]');
      if (tabIndexed && tabIndexed.scrollHeight > 300) {
        IU.log.debug('chatContainer: found via tabindex');
        return tabIndexed;
      }

      IU.log.error('chatContainer: could not find any suitable container');
      return null;
    },

    /* ─── Message Rows ────────────────────────────────────────── */

    /**
     * All individual message row elements within the chat container.
     * @param {HTMLElement} [container] — Optional parent to search within
     * @returns {HTMLElement[]}
     */
    messageRows(container) {
      const root = container || document;

      // Attempt 1: Explicit ARIA roles
      const explicitRows = root.querySelectorAll('[role="row"], [role="listitem"]');
      if (explicitRows.length > 0) return [...explicitRows];

      // Attempt 2: Traverse down through single-child wrappers
      // React virtualized lists or scroll containers often wrap items in a single inner <div>
      let current = root;
      let depth = 0;
      
      // Go down the tree as long as there's only 1 child, up to 5 levels deep
      while (current && current.children.length === 1 && depth < 5) {
        current = current.children[0];
        depth++;
      }

      // If we found a level with multiple children, these are likely the message rows
      if (current && current.children.length > 1) {
        // Filter out obvious non-message children (like tiny spacer divs)
        const candidates = [...current.children].filter(child => {
          return child.clientHeight > 10 || child.querySelector('div[dir="auto"], img, audio, video');
        });
        
        if (candidates.length > 0) {
          IU.log.debug(`messageRows: found ${candidates.length} rows via wrapper traversal at depth ${depth}`);
          return candidates;
        }
      }

      // Attempt 3: Deep search for message content markers and group by closest common parent
      const contentMarkers = root.querySelectorAll('div[dir="auto"], img[src*="cdninstagram"], img[src*="fbcdn"], audio');
      if (contentMarkers.length > 0) {
         // This is a last resort fallback, we just return the elements themselves 
         // which isn't ideal for the row-based unsend engine, but better than nothing.
         IU.log.warn(`messageRows: falling back to content markers (${contentMarkers.length} found)`);
         return [...contentMarkers];
      }

      IU.log.warn('messageRows: no message rows found');
      return [];
    },

    /* ─── Message Interaction ─────────────────────────────────── */

    /**
     * The "More options" / three-dot button that appears on hover.
     * @param {HTMLElement} messageEl
     * @returns {HTMLElement|null}
     */
    moreOptionsButton(messageEl) {
      // Primary: ARIA-based — button with a popup menu
      const ariaBtn = messageEl.querySelector(
        '[role="button"][aria-haspopup="menu"]'
      );
      if (ariaBtn) return ariaBtn;

      // Secondary: button with "More" in aria-label
      const moreBtn = messageEl.querySelector(
        '[role="button"][aria-label*="More"], [role="button"][aria-label*="more"]'
      );
      if (moreBtn) return moreBtn;

      // Tertiary: any button containing an SVG (icon button) that isn't the reaction button
      const buttons = messageEl.querySelectorAll('[role="button"]');
      for (const btn of buttons) {
        if (btn.querySelector('svg') && !btn.closest('[aria-label*="React"]')) {
          return btn;
        }
      }

      return null;
    },

    /**
     * The "Unsend" option inside the context menu popup.
     * @returns {HTMLElement|null}
     */
    unsendMenuItem() {
      // Look for menu items with "Unsend" text (case-insensitive)
      const items = document.querySelectorAll('[role="menuitem"], [role="button"]');
      for (const item of items) {
        const text = item.textContent?.trim().toLowerCase();
        if (text === 'unsend') return item;
      }

      // Fallback: look inside any visible dialog/menu
      const dialogs = document.querySelectorAll('[role="dialog"], [role="menu"]');
      for (const dialog of dialogs) {
        const buttons = dialog.querySelectorAll('[role="button"], button');
        for (const btn of buttons) {
          if (btn.textContent?.trim().toLowerCase() === 'unsend') return btn;
        }
      }

      return null;
    },

    /**
     * The confirmation "Unsend" button in the confirmation dialog.
     * Instagram shows "Unsend" again in a confirmation popup.
     * @returns {HTMLElement|null}
     */
    unsendConfirmButton() {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      for (const dialog of dialogs) {
        const buttons = dialog.querySelectorAll('button, [role="button"]');
        for (const btn of buttons) {
          const text = btn.textContent?.trim().toLowerCase();
          if (text === 'unsend') return btn;
        }
      }
      return null;
    },

    /* ─── Timestamps ──────────────────────────────────────────── */

    /**
     * All timestamp elements in the chat (date dividers and message times).
     * @param {HTMLElement} [container]
     * @returns {HTMLElement[]}
     */
    timestamps(container) {
      const root = container || document;
      const results = [];

      // <time> elements with datetime attributes
      root.querySelectorAll('time[datetime]').forEach((el) => results.push(el));

      // Date divider headers (Instagram shows "January 15, 2024" etc.)
      root.querySelectorAll('[role="heading"]').forEach((el) => {
        if (el.textContent?.match(/\b\d{4}\b/)) results.push(el);
      });

      return results;
    },

    /* ─── Media Type Detection ────────────────────────────────── */

    /**
     * Check if a message element contains a photo/image.
     * @param {HTMLElement} el
     * @returns {boolean}
     */
    isPhoto(el) {
      const imgs = el.querySelectorAll('img');
      for (const img of imgs) {
        const src = img.src || '';
        // Instagram CDN image sources
        if (
          src.includes('cdninstagram') ||
          src.includes('fbcdn') ||
          src.includes('scontent')
        ) {
          // Exclude tiny images (profile pics, emojis)
          const w = img.naturalWidth || img.width || 0;
          if (w > 60) return true;
        }
      }
      return false;
    },

    /**
     * Check if a message element contains a voice note.
     * @param {HTMLElement} el
     * @returns {boolean}
     */
    isVoice(el) {
      // Audio elements
      if (el.querySelector('audio')) return true;

      // Voice note slider (Instagram renders voice notes with a slider control)
      const slider = el.querySelector('[role="slider"]');
      if (slider) return true;

      // Waveform visualization (SVG or canvas patterns)
      const ariaVoice = el.querySelector('[aria-label*="voice"], [aria-label*="Voice"], [aria-label*="audio"], [aria-label*="Audio"]');
      if (ariaVoice) return true;

      return false;
    },

    /**
     * Check if a message element contains a shared reel or post link.
     * @param {HTMLElement} el
     * @returns {boolean}
     */
    isReel(el) {
      const links = el.querySelectorAll('a[href]');
      for (const link of links) {
        const href = link.href || '';
        if (
          href.includes('/reel/') ||
          href.includes('/reels/') ||
          href.includes('/p/')    ||
          href.includes('instagram.com/tv/')
        ) {
          return true;
        }
      }
      return false;
    },

    /**
     * Check if a message element contains user-authored text.
     * @param {HTMLElement} el
     * @returns {boolean}
     */
    isText(el) {
      const textNode = el.querySelector('div[dir="auto"]');
      if (!textNode) return false;
      const text = textNode.textContent?.trim();
      return text && text.length > 0;
    },

    /**
     * Get the text content of a message element.
     * @param {HTMLElement} el
     * @returns {string}
     */
    getTextContent(el) {
      const textNode = el.querySelector('div[dir="auto"]');
      return textNode?.textContent?.trim() || '';
    },

    /* ─── Authorship Detection ────────────────────────────────── */

    /**
     * Determine if a message was sent by the current user.
     * Instagram right-aligns sent messages. We detect this via
     * layout position or the presence of the "Unsend" option.
     *
     * @param {HTMLElement} el — A message row element
     * @returns {boolean}
     */
    isSentByUser(el) {
      // Strategy 1: Check for "More options" button with menu
      // Only the user's own messages have the Unsend option
      const moreBtn = el.querySelector('[role="button"][aria-haspopup="menu"]');
      if (moreBtn) return true;

      // Strategy 2: Check alignment — sent messages are right-aligned
      // Instagram uses flex with justify-content or margin-left: auto
      const style = window.getComputedStyle(el);
      if (style.justifyContent === 'flex-end') return true;

      // Strategy 3: Check for margin-left: auto on child containers
      for (const child of el.children) {
        const childStyle = window.getComputedStyle(child);
        if (childStyle.marginLeft === 'auto' || childStyle.justifyContent === 'flex-end') {
          return true;
        }
      }

      return false;
    },
  };

})();
