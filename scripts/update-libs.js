#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LIB_DIR = path.join(__dirname, '..', 'lib', 'osd-paperjs-annotation');
const REPO_URL = 'https://github.com/pearcetm/osd-paperjs-annotation.git';

async function updateLibraries() {
    console.log('🔄 Updating osd-paperjs-annotation repository');
    console.log(`📁 Target directory: ${LIB_DIR}`);

    try {
        if (fs.existsSync(LIB_DIR)) {
            console.log('📂 Repository exists, pulling latest changes...');
            execSync('git pull origin main', { cwd: LIB_DIR, stdio: 'inherit' });
        } else {
            console.log('📥 Cloning repository...');
            execSync(`git clone ${REPO_URL} "${LIB_DIR}"`, { stdio: 'inherit' });
        }

        // Update version file
        const versionContent = `osd-paperjs-annotation - Complete Repository
Downloaded on: ${new Date().toISOString().split('T')[0]}
Source: ${REPO_URL}
Method: git clone/pull (complete repository)
Status: All dependencies included`;

        fs.writeFileSync(path.join(LIB_DIR, 'version.txt'), versionContent);

        console.log('✅ Library update completed successfully!');
        console.log('📝 Updated version.txt');

    } catch (error) {
        console.error('❌ Error updating libraries:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    updateLibraries();
}

module.exports = { updateLibraries };