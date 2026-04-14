/**
 * Sanitization helpers — strip XSS from user-controlled strings.
 * Uses the `sanitize-html` package which is already installed.
 */
const sanitizeHtml = require('sanitize-html');

/**
 * Strip ALL HTML tags — safe for plain-text fields like task names, titles, emails.
 * @param {string} str
 * @returns {string}
 */
const sanitizeText = (str) => {
  if (str === null || str === undefined) return str;
  return sanitizeHtml(String(str), { allowedTags: [], allowedAttributes: {} }).trim();
};

/**
 * Allow a safe subset of rich-text HTML — for description / comment fields.
 * Removes scripts, event attrs, iframes etc. while keeping bold, italic, links, lists.
 * @param {string} str
 * @returns {string}
 */
const sanitizeRich = (str) => {
  if (str === null || str === undefined) return str;
  return sanitizeHtml(String(str), {
    allowedTags: [
      'b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'ol', 'li',
      'br', 'h1', 'h2', 'h3', 'blockquote', 'code', 'pre', 'span',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      span: ['style'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
  }).trim();
};

module.exports = { sanitizeText, sanitizeRich };
