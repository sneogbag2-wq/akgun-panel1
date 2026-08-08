import fs from 'fs';
import { execSync } from 'child_process';

const FILE_PATH = './src/modules/reports/financialReadService.js';
const TEST_COMMAND = 'node --test src/modules/reports/__tests__/financialReadAcceptance.test.js';

console.log('🛡️ V4 Anayasası: Paket 12A Mutasyon (Anti-Mock) Kalkanı Başlatılıyor...\n');

const originalCode = fs.readFileSync(FILE_PATH, 'utf-8');

const mutations = [
  {
    name: 'DSO Formül İhlali (Gün Çarpanını Silmek)',
    // Orijinal kod: const dso = (totalReceivables / totalSales) * daysInPeriod;
    find: "const dso = (totalReceivables / totalSales) * daysInPeriod;",
    replace: "const dso = (totalReceivables / totalSales);" // Gün çarpanını kaldırdık, formül patlamalı
  }
];

let killed = 0;
let survived = 0;

for (let i = 0; i < mutations.length; i++) {
  const mutation = mutations[i];
  if (!originalCode.includes(mutation.find)) {
    console.log(`⚠️ Hata: Mutasyon uygulanacak kod bulunamadı: ${mutation.name}`);
    continue;
  }

  const mutatedCode = originalCode.replace(mutation.find, mutation.replace);
  fs.writeFileSync(FILE_PATH, mutatedCode, 'utf-8');

  try {
    execSync(TEST_COMMAND, { stdio: 'ignore' });
    survived++;
    console.log(`❌ MUTANT SURVIVED (Sahte Test Algılandı!): ${mutation.name}`);
  } catch (err) {
    killed++;
    console.log(`✅ MUTANT KILLED (Testler İşe Yarıyor): ${mutation.name}`);
  }
}

fs.writeFileSync(FILE_PATH, originalCode, 'utf-8');

const total = killed + survived;
const score = Math.round((killed / total) * 100);

console.log(`\n📊 MUTASYON SKORU: %${score} (${killed}/${total} Mutant Öldürüldü)`);

if (score === 100) {
  console.log('🟢 SONUÇ: PASS. Testler dürüst, sahte yeşil (mock) algılanmadı.');
  process.exit(0);
} else {
  console.log('🔴 SONUÇ: FAIL. Sahte test (Anti-Mocking ihlali) tespit edildi!');
  process.exit(1);
}
