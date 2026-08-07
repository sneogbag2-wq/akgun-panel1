import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

let testCount = 0;
function countTests(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            countTests(fullPath);
        } else if (fullPath.endsWith('.test.js')) {
            testCount++;
        }
    }
}

countTests('src/modules');
console.log(`Found ${testCount} test files.`);

// Expected minimum count is 23 (as stated in Priority 6: "23 test dosyasının tamamını...")
if (testCount < 23) {
    console.error(`❌ Test kapsamı yetersiz! Beklenen en az: 23, Bulunan: ${testCount}`);
    process.exit(1);
} else {
    console.log(`✅ Test kapsamı yeterli (${testCount} dosya).`);
    try {
        execSync('npm run test', { stdio: 'inherit' });
    } catch (e) {
        process.exit(1);
    }
}
