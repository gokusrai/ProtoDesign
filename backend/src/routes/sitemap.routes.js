import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Helper to escape XML special characters like &
const escapeXml = (unsafe) => {
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
};

router.get('/sitemap.xml', async (req, res) => {
    try {
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

        products.forEach(product => {
            const date = product.updated_at ? new Date(product.updated_at).toISOString() : new Date().toISOString();
            const productIdentifier = product.slug || product.id;

            xml += `
            <url>
                // ✅ FIX: Added escapeXml() to the URL location
                <loc>${escapeXml(baseUrl)}/product/${escapeXml(productIdentifier)}</loc>
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
