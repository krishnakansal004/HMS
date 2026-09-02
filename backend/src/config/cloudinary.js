import multer from 'multer';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

// Export memory-backed multer instances
export const uploadPatients = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } });
export const uploadAppointments = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } });
export const uploadPlanRequests = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } });

// Helper to manually upload a single multer file object buffer to Firebase Storage (drop-in wrapper)
export const uploadToCloudinary = async (fileBuffer, folderName, resourceType = 'auto') => {
    try {
        const uuid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const filename = `hms/${folderName}/${uuid}`;
        
        const bucket = admin.storage().bucket();
        const file = bucket.file(filename);

        let contentType = undefined;
        if (folderName === 'plan-receipts' || folderName === 'prescriptions') {
            contentType = 'application/pdf';
        }

        await file.save(fileBuffer, {
            metadata: {
                contentType
            }
        });

        // Generate signed URL with far future expiration
        const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: '03-01-2500' // Year 2500
        });

        console.log(`[Firebase Storage] Uploaded ${filename} successfully. URL: ${signedUrl}`);

        return {
            secure_url: signedUrl,
            public_id: filename,
            url: signedUrl
        };
    } catch (e) {
        console.error('[Firebase Storage] Upload error:', e);
        throw e;
    }
};

// Placeholder object to prevent import errors if default export is used
export const cloudinary = {
    config: () => {},
    uploader: {
        destroy: async (publicId) => {
            try {
                const bucket = admin.storage().bucket();
                await bucket.file(publicId).delete();
                return { result: 'ok' };
            } catch (e) {
                console.warn('[Firebase Storage] Delete warning:', e.message);
                return { result: 'not_found' };
            }
        }
    }
};

export default cloudinary;
