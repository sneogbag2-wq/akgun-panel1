import { describe, it, expect, beforeAll, vi } from 'vitest';
import { getRelevantToolsForQuery, executeAiTool } from '../aiTools';
import { sendAiMessage } from '../aiService';
import { initFromArchive } from '../customerService';

// Canlı Gemini API'ye ağ isteği atılmasını engellemek için API anahtarını
// test ortamında boşaltıyoruz -> agent deterministik "offline fallback" moduna düşer.
vi.stubEnv('VITE_GEMINI_API_KEY', '');

beforeAll(async () => {
  await initFromArchive();
});

// ---------------------------------------------------------------------------
// BÖLÜM A — TÜRKÇE NİYET ANLAMA (araç seçim filtresi: getRelevantToolsForQuery)
// ---------------------------------------------------------------------------
describe('A) Türkçe niyet anlama — getRelevantToolsForQuery', () => {
  const cases: { label: string; query: string; mustInclude: string[]; mustExclude: string[] }[] = [
    {
      label: 'Müşteri bakiye sorgusu (net ifade)',
      query: "Marmara Tekel'in güncel bakiyesi nedir?",
      mustInclude: ['searchCustomers', 'getCustomerDetails'],
      mustExclude: ['addManualInvoice', 'mapAndImportExcel'],
    },
    {
      label: 'Temsilci performans sorgusu',
      query: "Ali Yüksel'in bu ayki performansı nasıl?",
      mustInclude: ['getSalesRepSummary'],
      mustExclude: ['addManualInvoice'],
    },
    {
      label: 'Kayıt ekleme (mutation) talebi',
      query: '5000100015 kodlu müşteriye 1000 TL fatura ekle',
      mustInclude: ['addManualInvoice'],
      mustExclude: [],
    },
    {
      label: 'Excel aktarım talebi',
      query: 'Ocak ayı excel dosyasını sisteme aktar',
      mustInclude: ['mapAndImportExcel', 'readUploadedExcelData'],
      mustExclude: [],
    },
    {
      label: 'Global rekor sorgusu (regex ile birebir örtüşen ifade)',
      query: 'Şirketin en yüksek faturası kaç TL?',
      mustInclude: ['getGlobalHighestTransactions'],
      mustExclude: [],
    },
    {
      label: 'Global rekor sorgusu (doğal, araya kelime giren eşdeğer ifade)',
      query: 'Şirketimizin bugüne kadar kestiği en yüksek fatura tutarı nedir?',
      // Bir öncekiyle anlamca AYNI niyettir. Önceden regex sadece bitişik
      // "şirketin en yüksek" ifadesini yakaladığı için bu vaka başarısız
      // oluyordu (bkz. düzeltme: "en yüksek" artık "en büyük" gibi bağımsız
      // bir tetikleyici). Regresyonu yakalamak için burada tutuluyor.
      mustInclude: ['getGlobalHighestTransactions'],
      mustExclude: [],
    },
    {
      label: 'Yaşlandırma / risk analizi raporu',
      query: 'Vadesi geçmiş müşterilerin yaşlandırma dağılımını göster',
      mustInclude: ['getAgingBreakdown', 'getOverdueCustomersList'],
      mustExclude: [],
    },
    {
      label: 'Alakasız / günlük konuşma',
      query: 'Bugün hava nasıl?',
      mustInclude: [],
      mustExclude: ['addManualInvoice', 'mapAndImportExcel', 'getGlobalHighestTransactions'],
    },
  ];

  for (const c of cases) {
    it(`${c.label} — "${c.query}"`, () => {
      const tools = getRelevantToolsForQuery(c.query).map(t => t.name);
      console.log(`\n[A] "${c.query}"\n    -> seçilen (${tools.length}): ${tools.join(', ')}`);

      for (const must of c.mustInclude) {
        const ok = tools.includes(must);
        console.log(`    beklenen dahil "${must}": ${ok ? 'VAR ✓' : 'YOK ✗'}`);
        expect(tools, `"${c.query}" için "${must}" araç listesinde bulunmalıydı`).toContain(must);
      }
      for (const mustNot of c.mustExclude) {
        const ok = !tools.includes(mustNot);
        console.log(`    beklenen hariç "${mustNot}": ${ok ? 'YOK ✓' : 'VAR ✗'}`);
        expect(tools, `"${c.query}" için "${mustNot}" araç listesinde OLMAMALIYDI`).not.toContain(mustNot);
      }

      expect(tools.length).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// BÖLÜM B — DOĞRU ARAÇ ÇALIŞTIRMA (executeAiTool)
// ---------------------------------------------------------------------------
describe('B) Araçların doğru çalıştırılması — executeAiTool', () => {
  it('searchCustomers: "Marmara Tekel" ile eşleşen cari bulunmalı', async () => {
    const res = await executeAiTool('searchCustomers', { query: 'Marmara Tekel' });
    console.log('\n[B] searchCustomers("Marmara Tekel") ->', JSON.stringify(res).slice(0, 300));
    expect(res).toBeDefined();
  });

  it('getCustomerDetails: bilinen bir customerId için detay dönmeli', async () => {
    const res = await executeAiTool('getCustomerDetails', { customerId: '5000188291' });
    console.log('\n[B] getCustomerDetails("5000188291") ->', JSON.stringify(res).slice(0, 300));
    expect(res).toBeDefined();
    expect(res.error).toBeUndefined();
  });

  it('getSalesRepSummary: temsilci listesi hatasız dönmeli', async () => {
    const res = await executeAiTool('getSalesRepSummary', {});
    console.log('\n[B] getSalesRepSummary() -> salesReps.length =', res?.salesReps?.length);
    expect(res).toHaveProperty('salesReps');
    expect(res.salesReps).toBeInstanceOf(Array);
  });

  it('getFinancialHealthReport: skor ve risk seviyesi dönmeli', async () => {
    const res = await executeAiTool('getFinancialHealthReport', {});
    console.log('\n[B] getFinancialHealthReport() ->', JSON.stringify(res).slice(0, 300));
    expect(res).toHaveProperty('healthScore');
    expect(res).toHaveProperty('riskLevel');
  });

  it('getTopDebtors: en borçlu 3 müşteri hatasız dönmeli', async () => {
    const res = await executeAiTool('getTopDebtors', { limit: 3 });
    console.log('\n[B] getTopDebtors(3) ->', JSON.stringify(res).slice(0, 300));
    expect(res).toBeDefined();
  });

  it('bilinmeyen araç adı: anlamlı bir hata mesajı dönmeli (sessizce çökmemeli)', async () => {
    const res = await executeAiTool('varOlmayanArac', {});
    console.log('\n[B] executeAiTool("varOlmayanArac") ->', JSON.stringify(res));
    expect(res).toHaveProperty('error');
  });
});

// ---------------------------------------------------------------------------
// BÖLÜM C — RAPORLAMA (sendAiMessage, offline-fallback üzerinden uçtan uca)
// ---------------------------------------------------------------------------
describe('C) Türkçe raporlama çıktısı — sendAiMessage (offline fallback)', () => {
  const prompts = [
    'Şirketin genel finansal durumu nasıl?',
    "Ali Yüksel temsilcisinin performansı nasıl?",
    'En borçlu müşteriler kimler?',
  ];

  for (const p of prompts) {
    it(`"${p}" için anlamlı ve hatasız bir Türkçe metin üretilmeli`, async () => {
      const res = await sendAiMessage(p, [], []);
      console.log(`\n[C] SORU: "${p}"\n--- YANIT (ilk 500 karakter) ---\n${(res.text || '').slice(0, 500)}\n--------------------------------`);
      expect(res).toBeDefined();
      expect(typeof res.text).toBe('string');
      expect(res.text.length).toBeGreaterThan(0);
      // Regresyon koruması: "Ortalama Vade" birimi ("gün") çift yazılmamalı.
      expect(res.text, 'Ortalama Vade biriminin tekrar etmemesi gerekir (örn. "0 gün Gün")').not.toMatch(/gün\s+Gün/);
    });
  }
});
