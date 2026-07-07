/**
 * InstaUnsend — Message Classifier
 *
 * Classifies each message DOM element into a media type category
 * using the selectors from dom-selectors.js.
 *
 * Classification priority (first match wins):
 *   VOICE → PHOTO → REEL → TEXT → OTHER
 * Voice is checked first because voice notes may contain
 * fallback images that could false-match as photos.
 */
(function () {
  'use strict';

  const IU = (window.__IU = window.__IU || {});
  const S  = IU.Selectors;
  const MT = IU.MediaType;

  IU.Classifier = {
    /**
     * Classify a single message element.
     * @param {HTMLElement} messageEl
     * @returns {string} — One of IU.MediaType values
     */
    classify(messageEl) {
      if (!messageEl) return MT.OTHER;

      // Check voice first — voice notes may contain <img> fallbacks
      if (S.isVoice(messageEl)) return MT.VOICE;

      // Check photo — images from Instagram CDN
      if (S.isPhoto(messageEl)) return MT.PHOTO;

      // Check reel/shared post — links to /reel/, /p/, etc.
      if (S.isReel(messageEl))  return MT.REEL;

      // Check text — div[dir="auto"] with non-empty content
      if (S.isText(messageEl))  return MT.TEXT;

      // Anything else: stickers, GIFs, reactions, system messages
      return MT.OTHER;
    },

    /**
     * Classify all message rows in a container and return a structured map.
     * @param {HTMLElement} container — Chat container element
     * @returns {{ element: HTMLElement, type: string, text: string, isOwn: boolean }[]}
     */
    classifyAll(container) {
      const rows = S.messageRows(container);
      const results = [];

      for (const row of rows) {
        // Only include user-authored messages
        const isOwn = S.isSentByUser(row);

        results.push({
          element: row,
          type:    IU.Classifier.classify(row),
          text:    S.getTextContent(row),
          isOwn,
        });
      }

      return results;
    },

    /**
     * Get a summary count of message types.
     * @param {{ type: string }[]} classified — Array from classifyAll()
     * @returns {{ text: number, photo: number, voice: number, reel: number, shared_post: number, other: number, total: number }}
     */
    summarize(classified) {
      const counts = {
        text: 0, photo: 0, voice: 0,
        reel: 0, shared_post: 0, other: 0,
        total: classified.length,
      };

      for (const msg of classified) {
        if (counts.hasOwnProperty(msg.type)) {
          counts[msg.type]++;
        } else {
          counts.other++;
        }
      }

      return counts;
    },
  };

})();
