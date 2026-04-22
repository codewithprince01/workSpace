const { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand 
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const constants = require('../config/constants');
const logger = require('../utils/logger');
const fs = require('fs-extra');
const path = require('path');

let s3Client;

const normalizeHost = host => {
  const value = String(host || '').trim();
  if (!value) return 'http://localhost:3000';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return `http://${value}`;
};

console.log(`📦 Storage Service Initialized. Provider: ${constants.STORAGE_PROVIDER}`);

/**
 * Initialize S3 Client
 */
const getS3Client = () => {
  if (s3Client) return s3Client;

  if (process.env.AWS_ACCESS_KEY_ID) {
    s3Client = new S3Client({
      region: constants.SES_REGION, 
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
      // Support for S3-compatible storage like MinIO if S3_URL is provided
      endpoint: process.env.S3_URL || undefined,
      forcePathStyle: !!process.env.S3_URL,
    });
  }
  return s3Client;
};

/**
 * Generate a presigned URL for uploading
 * @param {string} fileKey - Destination path in bucket
 * @param {string} contentType - Mime type of the file
 */
exports.getUploadUrl = async (fileKey, contentType) => {
  const client = getS3Client();
  
  if (constants.STORAGE_PROVIDER === 's3' && client) {
    const command = new PutObjectCommand({
      Bucket: constants.S3_BUCKET,
      Key: fileKey,
      ContentType: contentType,
    });
    
    // URL expires in 15 minutes
    return await getSignedUrl(client, command, { expiresIn: 900 });
  }

  // Local fallback: Return a backend URL
  const host = normalizeHost(process.env.BACKEND_URL || process.env.HOSTNAME || 'localhost:3000');
  return `${host}/api/attachments/local-upload/${fileKey}`;
};

/**
 * Generate a presigned URL for downloading/viewing
 */
exports.getDownloadUrl = async (fileKey) => {
  const client = getS3Client();
  
  if (constants.STORAGE_PROVIDER === 's3' && client) {
    const command = new GetObjectCommand({
      Bucket: constants.S3_BUCKET,
      Key: fileKey,
    });
    
    return await getSignedUrl(client, command, { expiresIn: 3600 });
  }

  // Local fallback: Return direct link to local upload dir
  const host = normalizeHost(process.env.HOSTNAME || process.env.BACKEND_URL || 'localhost:3000');
  return `${host}/${constants.LOCAL_UPLOAD_DIR}/${fileKey}`;
};

/**
 * Upload a base64 string to storage
 * @param {string} fileKey - Destination path in bucket
 * @param {string} base64Data - Base64 encoded file data
 * @param {string} fileName - Original file name
 */
exports.uploadBase64 = async (fileKey, base64Data, fileName) => {
  const client = getS3Client();

  try {
    if (constants.STORAGE_PROVIDER === 's3' && client) {
      // Remove data URL prefix if present (e.g., "data:image/png;base64,")
      const base64String = base64Data.includes('base64,') 
        ? base64Data.split('base64,')[1] 
        : base64Data;
      
      const buffer = Buffer.from(base64String, 'base64');
      
      const command = new PutObjectCommand({
        Bucket: constants.S3_BUCKET,
        Key: fileKey,
        Body: buffer,
        ContentType: getContentType(fileName),
      });
      
      await client.send(command);
      logger.info(`S3: Uploaded file ${fileKey}`);
      
      // Return the public URL
      const endpoint = process.env.S3_URL || `https://${constants.S3_BUCKET}.s3.${constants.SES_REGION}.amazonaws.com`;
      return `${endpoint}/${fileKey}`;
    }

    // Local fallback: Save to local directory
    const base64String = base64Data.includes('base64,') 
      ? base64Data.split('base64,')[1] 
      : base64Data;
    
    const buffer = Buffer.from(base64String, 'base64');
    const localPath = path.join(process.cwd(), constants.LOCAL_UPLOAD_DIR || 'uploads', fileKey);
    
    // Ensure directory exists
    await fs.ensureDir(path.dirname(localPath));
    
    // Write file
    await fs.writeFile(localPath, buffer);
    logger.info(`Local Storage: Uploaded file ${fileKey}`);
    
    // Return local URL
    const host = normalizeHost(process.env.HOSTNAME || process.env.BACKEND_URL || 'localhost:3000');
    return `${host}/${constants.LOCAL_UPLOAD_DIR || 'uploads'}/${fileKey}`;
  } catch (error) {
    logger.error('Storage Service: Upload failed for %s - %s', fileKey, error.message);
    throw error;
  }
};

/**
 * Get content type based on file extension
 */
function getContentType(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const contentTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return contentTypes[ext] || 'application/octet-stream';
}

/**
 * Delete a file from storage
 */
exports.deleteFile = async (fileKey) => {
  const client = getS3Client();

  try {
    if (constants.STORAGE_PROVIDER === 's3' && client) {
      const command = new DeleteObjectCommand({
        Bucket: constants.S3_BUCKET,
        Key: fileKey,
      });
      await client.send(command);
      logger.info(`S3: Deleted file ${fileKey}`);
      return true;
    }

    // Local cleanup
    const localPath = path.join(process.cwd(), constants.LOCAL_UPLOAD_DIR, fileKey);
    if (await fs.exists(localPath)) {
      await fs.remove(localPath);
      logger.info(`Local Storage: Deleted file ${fileKey}`);
    }
    return true;
  } catch (error) {
    logger.error('Storage Service: Delete failed for %s - %s', fileKey, error.message);
    return false;
  }
};
