// setup.js - Helper script to install all dependencies
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log("🚀 Starting ProtoDesign Project Setup...");

const rootDir = __dirname;
const backendDir = path.join(rootDir, 'backend');

// Helper to run commands
const runCommand = (command, cwd) => {
    try {
        console.log(`\n> Running: ${command} in ${cwd}`);
        execSync(command, { stdio: 'inherit', cwd: cwd });
        return true;
    } catch (error) {
        console.error(`❌ Failed to execute ${command}`);
        return false;
    }
};

// 1. Install Frontend Dependencies
if (fs.existsSync(path.join(rootDir, 'package.json'))) {
    console.log("\n📦 Installing Frontend Dependencies...");
    runCommand('npm install', rootDir);
} else {
    console.error("❌ No package.json found in root folder.");
}

// 2. Install Backend Dependencies
if (fs.existsSync(path.join(backendDir, 'package.json'))) {
    console.log("\n📦 Installing Backend Dependencies...");
    runCommand('npm install', backendDir);

    // Copy .env.example to .env if it doesn't exist
    const envExample = path.join(backendDir, '.env.example');
    const envFile = path.join(backendDir, '.env');
    if (fs.existsSync(envExample) && !fs.existsSync(envFile)) {
        console.log("📄 Creating backend .env file from example...");
        fs.copyFileSync(envExample, envFile);
        console.log("⚠️  Please update backend/.env with your Database and Cloudinary credentials!");
    }
} else {
    console.error("❌ No backend folder or package.json found.");
}

console.log("\n✅ Setup Complete!");
console.log("==================================================");
console.log("1. Update 'backend/.env' with your DB credentials.");
console.log("2. Run the database script 'complete_schema.sql'.");
console.log("3. Start Backend: cd backend && npm run dev");
console.log("4. Start Frontend: npm run dev");
console.log("==================================================");