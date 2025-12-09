
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, '../test');
const files = fs.readdirSync(testDir);

files.forEach(file => {
    if (!file.endsWith('.js')) return;
    const filePath = path.join(testDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace imports from local utils
    // e.g. from './mathUtils' -> from '../utils/mathUtils'
    // But be careful not to double replace if I already fixed some.
    // My previous fix used '../utils/'.
    // So I match './' but NOT '../'.

    // Regex: from ' ./ ' (space optional, quotes)
    // Actually simple string replacement of "from './" -> "from '../utils/" is robust enough for this project structure.

    const newContent = content.replace(/from ['"]\.\/([^'"]+)['"]/g, (match, p1) => {
        return `from '../utils/${p1}'`;
    });

    if (content !== newContent) {
        console.log(`Fixing ${file}...`);
        fs.writeFileSync(filePath, newContent);
    }
});
