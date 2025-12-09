import pgPromise from 'pg-promise';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Initialize pg-promise
const pgp = pgPromise({
    // Receive event - convert snake_case (from PostgreSQL) to camelCase (for JavaScript)
    receive(data) {
        // Iterate over keys of the received data object (row)
        for (const prop in data) {
            // Regex to find an underscore followed by a lowercase letter (e.g., '_a')
            const camel = prop.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

            // If the property name was changed (i.e., it contained an underscore)
            if (prop !== camel) {
                // Assign the value to the new camelCase property
                data[camel] = data[prop];
                // Delete the original snake_case property
                delete data[prop];
            }
        }
    }
});

// Database connection configuration
const config = {
    host: process.env.DB_HOST || 'localhost',
    // Use Number() to ensure port is treated as a number
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'protodesign',
    user: process.env.DB_USER || 'protodesign_user',
    password: process.env.DB_PASSWORD || '0000'
};

// Validate required configuration (focusing on the essentials for connection)
if (!config.database || !config.user || !config.password) {
    console.error('❌ Missing required database configuration');
    console.error('Required: DB_NAME, DB_USER, DB_PASSWORD (and usually DB_HOST, DB_PORT)');
    process.exit(1);
}

// Create database instance
const db = pgp(config);

// Test connection
db.connect()
    .then((obj) => {
        console.log('✅ Database connection successful');
        obj.done(); // release connection
    })
    .catch((error) => {
        // In case of connection failure, print the error and exit
        console.error('❌ Database connection failed:', error.message);
        // Do not process.exit(1) here if this file is imported as a module,
        // as it might be used by a process that expects to handle the error elsewhere.
        // For a startup file, exiting might be appropriate.
    });

export default db;