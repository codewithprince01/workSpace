/**
 * Send success response
 */
exports.success = (res, data = null, message = 'Success', statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

/**
 * Send error response
 */
exports.error = (res, message = 'Error', statusCode = 400, errors = null) => {
  const response = {
    success: false,
    message
  };
  
  if (errors) {
    response.errors = errors;
  }
  
  res.status(statusCode).json(response);
};

/**
 * Send paginated response
 */
exports.paginated = (res, data, pagination, message = 'Success') => {
  res.json({
    success: true,
    message,
    data,
    pagination
  });
};
