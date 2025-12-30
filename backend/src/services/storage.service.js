import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import path from 'path';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

export const storageService = {
    async uploadFile(file, folder = 'misc') {
        return new Promise((resolve, reject) => {

            // Determine resource type
            let resourceType = 'auto';
            if (file.mimetype.startsWith('image/')) resourceType = 'image';
            else if (file.mimetype.startsWith('video/')) resourceType = 'video';
            else resourceType = 'raw';

            // 1. Sanitize Filename (Fixes "Invalid public_id" error)
            // Remove everything except letters, numbers, underscores, and hyphens
            const ext = path.extname(file.originalname); 
            const nameWithoutExt = path.basename(file.originalname, ext);
            const sanitized = nameWithoutExt.replace(/[^a-zA-Z0-9\-_]/g, '');

            // 2. Generate unique name
            const uniqueName = `${sanitized}_${Date.now()}${ext}`;

            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: `protodesign/${folder}`,
                    resource_type: resourceType,
                    public_id: uniqueName, 
                    use_filename: true,
                    unique_filename: false 
                },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result.secure_url);
                }
            );

            streamifier.createReadStream(file.buffer).pipe(uploadStream);
        });
    }
};
