const crypto = require('crypto');

/**
 * Request ID Middleware
 * Assigns a unique ID to every request for tracing and logging.
 */
const requestIdMiddleware = (req, res, next) => {
  // Generate a short-ish UUID
  const id = crypto.randomUUID();
  
  // Attach to request object for use in controllers/services
  req.id = id;
  
  // Send back in response headers for frontend traceability
  res.setHeader('X-Request-ID', id);
  
  next();
};

module.exports = requestIdMiddleware;
