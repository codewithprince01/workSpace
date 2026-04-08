const crypto = require('crypto');

/**
 * Generate random string
 */
exports.generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate project key from name
 */
exports.generateProjectKey = (name, existingKeys = []) => {
  let key = name
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 3)
    .toUpperCase();
  
  if (key.length < 2) {
    key = 'PRJ';
  }
  
  // Ensure unique key
  let counter = 1;
  let uniqueKey = key;
  while (existingKeys.includes(uniqueKey)) {
    uniqueKey = `${key}${counter}`;
    counter++;
  }
  
  return uniqueKey;
};

/**
 * Get random color
 */
exports.getRandomColor = () => {
  const colors = [
    '#1890ff', '#52c41a', '#fa8c16', '#722ed1', '#eb2f96',
    '#13c2c2', '#2f54eb', '#faad14', '#a0d911', '#f5222d'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

/**
 * Paginate results
 */
exports.paginate = (page = 1, limit = 20) => {
  const skip = (parseInt(page) - 1) * parseInt(limit);
  return {
    skip,
    limit: parseInt(limit)
  };
};

/**
 * Sanitize HTML
 */
exports.sanitizeHtml = (html) => {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/javascript:/gi, '');
};

/**
 * Format date
 */
exports.formatDate = (date, format = 'YYYY-MM-DD') => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day);
};
