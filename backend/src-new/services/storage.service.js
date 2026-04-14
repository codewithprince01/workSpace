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
  const host = process.env.BACKEND_URL || 'http://localhost:3000';
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
  return `${process.env.HOSTNAME || 'http://localhost:3000'}/${constants.LOCAL_UPLOAD_DIR}/${fileKey}`;
};

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
