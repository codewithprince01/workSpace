const path = require('path');
const logger = require('../utils/logger');
const { StoredFile } = require('../models');

const MAX_BLOB_SIZE_BYTES = 15 * 1024 * 1024; // MongoDB document safety limit margin

const normalizeHost = host => {
  const value = String(host || '').trim();
  if (!value) return 'http://localhost:3000';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return `http://${value}`;
};

const getBaseUrl = () => {
  if (process.env.BACKEND_URL) return normalizeHost(process.env.BACKEND_URL);
  if (process.env.HOSTNAME) return normalizeHost(process.env.HOSTNAME);
  return 'http://localhost:3000';
};

const getContentTypeByFileName = fileName => {
  const ext = path.extname(fileName || '').replace('.', '').toLowerCase();
  const map = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain',
    zip: 'application/zip',
    csv: 'text/csv',
  };
  return map[ext] || 'application/octet-stream';
};

const parseBase64Payload = (base64Data, fileName) => {
  const input = String(base64Data || '').trim();
  if (!input) {
    throw new Error('file data is required');
  }

  let contentType = getContentTypeByFileName(fileName);
  let rawBase64 = input;

  const dataUriMatch = input.match(/^data:([^;]+);base64,(.+)$/);
  if (dataUriMatch) {
    contentType = dataUriMatch[1] || contentType;
    rawBase64 = dataUriMatch[2];
  }

  const buffer = Buffer.from(rawBase64, 'base64');
  if (!buffer || buffer.length === 0) {
    throw new Error('invalid file data');
  }
  if (buffer.length > MAX_BLOB_SIZE_BYTES) {
    throw new Error(`file is too large for database storage (max ${Math.floor(MAX_BLOB_SIZE_BYTES / (1024 * 1024))}MB)`);
  }

  return { buffer, contentType };
};

exports.getUploadUrl = async () => {
  throw new Error('direct upload URL is disabled in database storage mode');
};

exports.getStoredFileUrl = fileKey => {
  if (!fileKey) return null;
  return `${getBaseUrl()}/api/files/by-key/${encodeURIComponent(String(fileKey))}`;
};

exports.getDownloadUrl = async fileKey => {
  return exports.getStoredFileUrl(fileKey);
};

exports.uploadBase64 = async (fileKey, base64Data, fileName, uploadedBy = null) => {
  const key = String(fileKey || '').trim();
  if (!key) throw new Error('file key is required');
  if (!fileName) throw new Error('file name is required');

  const { buffer, contentType } = parseBase64Payload(base64Data, fileName);

  await StoredFile.findOneAndUpdate(
    { file_key: key },
    {
      $set: {
        file_name: String(fileName),
        file_type: contentType,
        file_data: buffer,
        uploaded_by: uploadedBy || null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  logger.info('Stored file in DB (blob): %s', key);
  return exports.getStoredFileUrl(key);
};

exports.deleteFile = async fileKey => {
  try {
    const key = String(fileKey || '').trim();
    if (!key) return false;
    await StoredFile.deleteOne({ file_key: key });
    return true;
  } catch (error) {
    logger.error('DB file delete failed for %s - %s', fileKey, error.message);
    return false;
  }
};

exports.getFileByKey = async fileKey => {
  const key = String(fileKey || '').trim();
  if (!key) return null;
  return StoredFile.findOne({ file_key: key });
};

