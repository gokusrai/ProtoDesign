import pgPromise from 'pg-promise';
import dotenv from 'dotenv';

dotenv.config();

const pgp = pgPromise({
    receive(data) {
        // Convert snake_case to camelCase
        for (const prop in data) {
            const camel = prop.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            if (prop !== camel) {
                data[camel] = data[prop];
                delete data[prop];
            }
        }
    }
});

// Use DATABASE_URL for Production (Render), fallback to Localhost for Dev
const db = pgp(
    process.env.DATABASE_URL
        ? {
              connectionString: process.env.DATABASE_URL,
              ssl: { rejectUnauthorized: false } // Required for Neon/Render
          }
        : {
              host: process.env.DB_HOST || 'localhost',
              port: 5432,
              database: process.env.DB_NAME || 'protodesign',
              user: process.env.DB_USER || 'protodesign_user',
              password: process.env.DB_PASSWORD || '0000'
          }
);

db.connect()
    .then((obj) => {
        console.log('✅ Database connection successful');
        obj.done();
    })
    .catch((error) => {
        console.error('❌ Database connection failed:', error.message);
    });

export default db;
