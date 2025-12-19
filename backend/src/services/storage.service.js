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

            // Force extension for raw files (STLs)
            const ext = path.extname(file.originalname); // e.g., ".stl"
            const nameWithoutExt = path.basename(file.originalname, ext);

            // Generate unique filename WITH extension
            // Cloudinary 'public_id' usually doesn't include extension for raw files unless forced
            const uniqueName = `${nameWithoutExt}_${Date.now()}${ext}`;

            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: `protodesign/${folder}`,
                    resource_type: resourceType,
                    public_id: uniqueName, // ✅ Explicitly set name + extension
                    use_filename: true,
                    unique_filename: false // We handle uniqueness manually above
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