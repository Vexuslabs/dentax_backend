/**
 * DentalBox Backend Utility Helpers
 */

/**
 * Escapes characters with special meaning in regular expressions.
 * Prevents ReDoS (Regular Expression Denial of Service) and RegExp syntax injection errors.
 * @param {string} text
 * @returns {string}
 */
export const escapeRegex = (text) => {
  if (typeof text !== 'string') return '';
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Validates whether an input is a valid 24-character hexadecimal MongoDB ObjectId string.
 * @param {string} id
 * @returns {boolean}
 */
export const isValidObjectId = (id) => {
  if (typeof id !== 'string') return false;
  return /^[0-9a-fA-F]{24}$/.test(id);
};

export default {
  escapeRegex,
  isValidObjectId
};
