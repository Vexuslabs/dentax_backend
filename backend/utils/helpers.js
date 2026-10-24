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

/**
 * Returns a filter query scoped to the authenticated doctor's ID.
 * If user is an Admin, returns the base filter or applies doctorId if provided.
 * If user is a Doctor, strictly enforces user: req.user._id.
 * @param {object} req Express request object
 * @param {object} baseFilter Optional existing filter
 * @returns {object} Filter with user isolation
 */
export const getDoctorFilter = (req, baseFilter = {}) => {
  if (!req.user) return baseFilter;
  if (req.user.role === 'Admin') {
    if (req.query?.doctorId && isValidObjectId(req.query.doctorId)) {
      return { ...baseFilter, user: req.query.doctorId };
    }
    return baseFilter;
  }
  return { ...baseFilter, user: req.user._id || req.user.id };
};

/**
 * Checks if a document belongs to the authenticated doctor or if user is Admin.
 * @param {object} req Express request object
 * @param {object} doc Mongoose document
 * @returns {boolean}
 */
export const isOwnerOrAdmin = (req, doc) => {
  if (!req.user || !doc) return false;
  if (req.user.role === 'Admin') return true;
  const docUserId = doc.user ? (doc.user._id ? doc.user._id.toString() : doc.user.toString()) : null;
  const reqUserId = req.user._id ? req.user._id.toString() : req.user.id.toString();
  return docUserId === reqUserId;
};

export default {
  escapeRegex,
  isValidObjectId,
  getDoctorFilter,
  isOwnerOrAdmin
};

