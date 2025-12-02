const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');
const path = require('path');

// Initialize R2 client (S3-compatible)
const r2Client = process.env.R2_ACCOUNT_ID ? new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
}) : null;

const BUCKET_NAME = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = process.env.R2_PUBLIC_URL;

/**
 * Upload file to Cloudflare R2
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} originalName - Original filename
 * @param {string} mimeType - File MIME type
 * @param {string} folder - Folder path (e.g., 'avatars')
 * @returns {Promise<string>} - Public URL of uploaded file
 */
async function uploadFile(fileBuffer, originalName, mimeType, folder = 'uploads') {
    if (!r2Client) {
        throw new Error('R2 client not configured. Please set R2 environment variables.');
    }

    // Generate unique filename
    const ext = path.extname(originalName);
    const uniqueName = `${folder}/${crypto.randomBytes(16).toString('hex')}${ext}`;

    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: uniqueName,
        Body: fileBuffer,
        ContentType: mimeType,
    });

    await r2Client.send(command);

    // Return public URL
    return `${PUBLIC_URL}/${uniqueName}`;
}

/**
 * Delete file from Cloudflare R2
 * @param {string} fileUrl - Full URL or key of file to delete
 * @returns {Promise<void>}
 */
async function deleteFile(fileUrl) {
    if (!r2Client) {
        console.warn('R2 client not configured. Skipping file deletion.');
        return;
    }

    // Extract key from URL
    let key = fileUrl;
    if (fileUrl.startsWith('http')) {
        const url = new URL(fileUrl);
        key = url.pathname.substring(1); // Remove leading slash
    }

    const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    });

    try {
        await r2Client.send(command);
        console.log(`Deleted file from R2: ${key}`);
    } catch (err) {
        console.error('Error deleting file from R2:', err);
    }
}

/**
 * Check if R2 is configured
 * @returns {boolean}
 */
function isR2Configured() {
    return !!r2Client && !!BUCKET_NAME && !!PUBLIC_URL;
}

module.exports = {
    uploadFile,
    deleteFile,
    isR2Configured,
};
