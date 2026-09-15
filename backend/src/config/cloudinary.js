import { v2 as cloudinary } from 'cloudinary';
import { AppError } from '../middlewares/errorHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadToCloudinary(buffer, folder = 'invoices', resourceType = 'auto') {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error) {
          return reject(
            new AppError(`Cloudinary upload failed: ${error.message}`, HTTP_STATUS.INTERNAL_SERVER_ERROR)
          );
        }
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
}

export async function deleteFromCloudinary(publicId, resourceType = 'video') {
  if (!publicId) return { result: 'not_found' };
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

export function cloudinaryResourceType(mimeType) {
  if (String(mimeType || '').startsWith('audio/')) return 'video';
  if (String(mimeType || '').startsWith('video/')) return 'video';
  if (String(mimeType || '').startsWith('image/')) return 'image';
  return 'raw';
}

// Generate signed delivery only after application authentication and tenant
// authorization. Never call this from a bulk list query.
export function createSignedCloudinaryUrl(publicId, mimeType) {
  if (!publicId) {
    throw new AppError('Document storage reference is unavailable.', HTTP_STATUS.CONFLICT);
  }
  return cloudinary.url(publicId, {
    secure: true,
    sign_url: true,
    resource_type: cloudinaryResourceType(mimeType),
    type: 'upload',
  });
}
