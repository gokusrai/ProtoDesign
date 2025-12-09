-- 000_create_database.sql (run as postgres superuser)
CREATE DATABASE protodesign
    OWNER protodesign_user
    ENCODING UTF8
    LC_COLLATE 'en_US.utf-8'
    LC_CTYPE 'en_US.utf-8'
    TEMPLATE template0;

-- Grant all privileges to your app user
GRANT ALL PRIVILEGES ON DATABASE protodesign TO protodesign_user;
