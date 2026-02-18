import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import path from 'path';
import sharp from 'sharp'; // High-performance processor
import axios from 'axios';  // For fetching external images

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

export const storageService = {
    // 1. Upload from Buffer (File Uploads)
    async uploadFile(file, folder = 'misc') {
        return new Promise((resolve, reject) => {
            let resourceType = 'auto';
            if (file.mimetype && file.mimetype.startsWith('image/')) resourceType = 'image';
            else if (file.mimetype && file.mimetype.startsWith('video/')) resourceType = 'video';

            const ext = path.extname(file.originalname);
            const nameWithoutExt = path.basename(file.originalname, ext);
            const sanitized = nameWithoutExt.replace(/[^a-zA-Z0-9\-_]/g, '');
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
    },

    // 2. Upload from URL (Fixed for Bulk Import)
    async uploadFromUrl(url, folder = 'misc') {
        return new Promise((resolve, reject) => {
            cloudinary.uploader.upload(url, {
                folder: `protodesign/${folder}`,
                resource_type: 'image' // ✅ FORCE 'image' type (Fixes raw/no-extension issue)
            }, (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
            });
        });
    }
};
