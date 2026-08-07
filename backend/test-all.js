import { execSync } from 'child_process';
import fs from 'fs';

console.log('===================================================');
console.log(' 🏛️ V4 SİSTEM MATRİSİ - TEST VE MUTASYON MOTORU ');
console.log('===================================================\n');

try {
  console.log('⏳ 1. Aşama: Tüm V4 Birim ve Kabul Testleri Çalıştırılıyor...\n');
  
  // Bulunan tüm test dosyalarını toplamak için
  function getTestFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      file = dir + '/' + file;
      const stat = fs.statSync(file);
      if (stat && stat.isDirectory()) {
        results = results.concat(getTestFiles(file));
      } else if (file.endsWith('.test.js')) {
        results.push(file);
      }
    });
    return results;
  }
  
  const testFiles = getTestFiles('src').join(' ');
  execSync(`node --test ${testFiles}`, { stdio: 'inherit' });
  
  console.log('\n✅ 1. Aşama Başarılı! Tüm Testler (PASS)\n');
} catch (err) {
  console.error('\n❌ 1. Aşama Başarısız! Bir veya daha fazla test patladı.');
  process.exit(1);
}

import path from 'path';

console.log('===================================================');
console.log('🛡️ 2. Aşama: Anti-Mocking (Mutasyon) Kalkanı Devreye Giriyor...\n');

const mutatorDir = fs.existsSync('../scripts/tests') ? '../scripts/tests' : './';
const files = fs.readdirSync(mutatorDir);
const mutators = files.filter(f => f.endsWith('-mutation-tester.js') || f === 'mutation-tester.js');

let totalMutators = mutators.length;
let passedMutators = 0;

for (const mutator of mutators) {
  const mutatorPath = path.join(mutatorDir, mutator);
  console.log(`\n▶ Çalıştırılıyor: ${mutator}...`);
  try {
    execSync(`node "${mutatorPath}"`, { stdio: 'inherit' });
    passedMutators++;
  } catch (err) {
    console.error(`❌ HATA: ${mutator} mutasyon testini geçemedi (FAIL). Sahte test algılandı!`);
  }
}

console.log('\n===================================================');
if (passedMutators === totalMutators) {
  console.log(`🎉 NİHAİ SONUÇ: KUSURSUZ! V4 Anayasası %100 oranında korunmuştur.`);
  console.log(`🎉 Tüm testler dürüst, tüm mutasyonlar engellendi!`);
  process.exit(0);
} else {
  console.error(`🚨 KRİTİK İHLAL: ${totalMutators - passedMutators} adet mutasyon sızdı! KODLAR SAHTE!`);
  process.exit(1);
}
