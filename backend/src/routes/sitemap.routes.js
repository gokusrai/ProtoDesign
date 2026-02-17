import express from 'express';
import db from '../config/database.js'; // Importing the pg-promise instance

const router = express.Router();

router.get('/sitemap.xml', async (req, res) => {
    try {
        // Fetch id, slug, and updated_at for all non-archived products
        const products = await db.any('SELECT id, slug, updated_at FROM products WHERE is_archived = false');

        const baseUrl = 'https://www.protodesignstudio.com';

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url>
                <loc>${baseUrl}/</loc>
                <changefreq>daily</changefreq>
                <priority>1.0</priority>
            </url>
            <url>
                <loc>${baseUrl}/shop</loc>
                <changefreq>daily</changefreq>
                <priority>0.8</priority>
            </url>`;

        // Add dynamic product URLs
        products.forEach(product => {
            // Handle null updated_at by falling back to current date
            const date = product.updated_at ? new Date(product.updated_at).toISOString() : new Date().toISOString();
            
            // SEO IMPROVEMENT: Use slug if it exists, otherwise fall back to ID
            const productIdentifier = product.slug || product.id;

            xml += `
            <url>
                <loc>${baseUrl}/product/${productIdentifier}</loc>
                <lastmod>${date}</lastmod>
                <changefreq>weekly</changefreq>
                <priority>0.7</priority>
            </url>`;
        });

        xml += `</urlset>`;

        res.header('Content-Type', 'application/xml');
        res.send(xml);

    } catch (error) {
        console.error("Sitemap Error:", error);
        res.status(500).send('Error generating sitemap');
    }
});

export default router;
