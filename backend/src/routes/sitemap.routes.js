import express from 'express';
import pool from '../config/database.js'; // Adjust if your DB config export is different

const router = express.Router();

router.get('/sitemap.xml', async (req, res) => {
    try {
        // Fetch all non-archived product IDs
        const result = await pool.query('SELECT id, updated_at FROM products WHERE is_archived = false');
        const products = result.rows;

        // CHANGE THIS TO YOUR REAL DOMAIN
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
            const date = product.updated_at ? new Date(product.updated_at).toISOString() : new Date().toISOString();
            xml += `
            <url>
                <loc>${baseUrl}/product/${product.id}</loc>
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