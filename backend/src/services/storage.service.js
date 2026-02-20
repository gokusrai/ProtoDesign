import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import path from 'path';
import sharp from 'sharp'; 
import axios from 'axios';  

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

export const storageService = {
    /**
     * Internal helper to optimize and convert images to WebP
     */
    async optimizeImage(buffer) {
        return await sharp(buffer)
            .webp({ quality: 80 }) // 80 quality provides the best balance of size and clarity
            .toBuffer();
    },

    /**
     * 1. Upload from Buffer (User File Uploads)
     * Automatically detects images and converts them to WebP before streaming to Cloudinary
     */
    async uploadFile(file, folder = 'misc') {
        let buffer = file.buffer;
        const isImage = file.mimetype && file.mimetype.startsWith('image/');
        const resourceType = isImage ? 'image' : (file.mimetype?.startsWith('video/') ? 'video' : 'auto');

        // Optimization: Convert to WebP if it's an image
        if (isImage) {
            try {
                buffer = await this.optimizeImage(buffer);
            } catch (err) {
                console.error("Sharp optimization failed, uploading original:", err);
            }
        }

        const ext = isImage ? '.webp' : path.extname(file.originalname);
        const nameWithoutExt = path.basename(file.originalname, path.extname(file.originalname));
        const sanitized = nameWithoutExt.replace(/[^a-zA-Z0-9\-_]/g, '');
        const uniqueName = `${sanitized}_${Date.now()}`;

        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: `protodesign/${folder}`,
                    resource_type: resourceType,
                    public_id: uniqueName,
                    format: isImage ? 'webp' : undefined,
                    use_filename: true,
                    unique_filename: false
                },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result.secure_url);
                }
            );
            streamifier.createReadStream(buffer).pipe(uploadStream);
        });
    },

    /**
     * 2. Upload from URL (Fixed for Bulk Import & SEO)
     * Fetches the image first to optimize it locally before storage.
     * Accepts a fileName for SEO-friendly public_ids.
     */
    async uploadFromUrl(url, folder = 'misc', fileName = 'product') {
        try {
            // Clean the product name for the filename (SEO best practice)
            const sanitizedName = fileName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const publicId = `${sanitizedName}_${Date.now()}`;

            // Fetch the image data ourselves to ensure we can optimize it locally
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            const optimizedBuffer = await this.optimizeImage(Buffer.from(response.data));

            return new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        folder: `protodesign/${folder}`,
                        resource_type: 'image',
                        format: 'webp',
                        public_id: publicId // ✅ Fixed: Set descriptive filename for Google Images
                    },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve(result.secure_url);
                    }
                );
                streamifier.createReadStream(optimizedBuffer).pipe(uploadStream);
            });
        } catch (error) {
            // Graceful fallback to direct Cloudinary upload if local optimization fails
            console.warn("Optimized URL upload failed, attempting direct upload:", error.message);
            return new Promise((resolve, reject) => {
                cloudinary.uploader.upload(url, {
                    folder: `protodesign/${folder}`,
                    resource_type: 'image'
                }, (error, result) => {
                    if (error) return reject(error);
                    resolve(result.secure_url);
                });
            });
        }
    }
};
