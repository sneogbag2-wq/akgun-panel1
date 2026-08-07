// src/components/modals/CustomerAnalysisModal.tsx
import {
  getCustomerPaymentTrendSync,
  calculateSevkiyatAnalysisSync,
  calculateDashboardFocusAnalysisSync,
  calculateCariHesapFocusAnalysisSync,
} from '../../services/customerService';
import { formatCurrency } from '../../utils/formatters';

interface Props {
  customer: any;
  // Modalın hangi sayfadan açıldığı. AiChatPanel.tsx'teki hover-kartı yönlendirmesiyle
  // aynı eşleme kullanılır (bkz. subscribeHoverAnalyticsData bloğu): 'dashboard' ve
  // 'cari-hesaplar' kendi odaklı analiz fonksiyonlarını kullanır, geri kalan her şey
  // (fatura-kontrol dahil — o sayfaya özgü calculateDeepInvoiceAnalysisSync bir
  // `selectedDate` gerektirdiğinden ve modalda "seçili tarih" kavramı olmadığından)
  // sevkiyat & güvenilirlik odaklı fallback analize düşer.
  page?: 'dashboard' | 'cari-hesaplar' | 'fatura-kontrol' | 'sevkiyat-takip' | string;
}

const TREND_META: Record<string, { label: string }> = {
  SLOWING:   { label: 'Yavaşlıyor' },
  IMPROVING: { label: 'Hızlanıyor' },
  STABLE:    { label: 'Dengeli' },
};

const METHOD_ICON: Record<string, string> = {
  krediKarti: '#i-card',
  havale: '#i-transfer',
  nakit: '#i-banknote',
};

// B5 düzeltmesi: calculateSevkiyatAnalysisSync / calculateDashboardFocusAnalysisSync /
// calculateCariHesapFocusAnalysisSync üç farklı şekilde `metrics` nesnesi döndürüyor
// (page prop'una göre hangisi çağrıldığına bağlı); bu alanlar önceden hiç render
// edilmiyor, yalnızca serbest metin (report1/2/3) içinde geçiyordu. Aşağıdaki eşleme,
// hangi metrics anahtarı gelirse gelsin okunabilir etiket + biçim ile küçük rozet
// kartlarına çeviriyor. Zaten başka panellerde ayrıca gösterilen alanlar (preferredMethod,
// trendDirection) burada tekrar edilmesin diye bilinçli olarak dışarıda bırakıldı.
const FOCUS_METRIC_META: Record<string, { label: string; format: (v: any) => string; tone?: (v: any) => 'good' | 'warn' | 'bad' }> = {
  reliabilityScore: {
    label: 'Güvenilirlik Skoru',
    format: (v) => `%${v}`,
    tone: (v) => (v >= 70 ? 'good' : v >= 40 ? 'warn' : 'bad'),
  },
  paymentProfile: {
    label: 'Ödeme Profili',
    format: (v) => String(v),
  },

  riskLevel: {
    label: 'Risk Seviyesi',
    format: (v) => (v === 'HIGH' ? 'Yüksek' : v === 'MEDIUM' ? 'Orta' : v === 'LOW' ? 'Düşük' : String(v)),
    tone: (v) => (v === 'HIGH' ? 'bad' : v === 'MEDIUM' ? 'warn' : 'good'),
  },
  riskScore: {
    label: 'Risk Skoru',
    format: (v) => `%${v}`,
    tone: (v) => (v >= 70 ? 'bad' : v >= 40 ? 'warn' : 'good'),
  },
  balance: {
    label: 'Açık Bakiye',
    format: (v) => formatCurrency(v),
  },
  averageTermDays: {
    label: 'Ort. Vade',
    format: (v) => `${v} gün`,
  },
  overdueAmount: {
    label: '60g+ Gecikmiş Bakiye',
    format: (v) => formatCurrency(v),
    tone: (v) => (v > 0 ? 'bad' : 'good'),
  },
};

const TONE_COLOR: Record<'good' | 'warn' | 'bad', string> = {
  good: 'var(--cv2-green)',
  warn: 'var(--cv2-amber)',
  bad: 'var(--cv2-red, #ef4444)',
};

export default function CustomerAnalysisBody({ customer, page }: Props) {
  const trendData = getCustomerPaymentTrendSync(customer);

  // AiChatPanel.tsx'teki subscribeHoverAnalyticsData yönlendirmesiyle aynı eşleme:
  // dashboard -> genel finansal sağlık özeti, cari-hesaplar -> ekstre/vade detayı,
  // diğer her şey (fatura-kontrol, sevkiyat-takip, page belirtilmemiş) -> sevkiyat & güvenilirlik odaklı analiz.
  const focusAnalysis = page === 'dashboard'
    ? calculateDashboardFocusAnalysisSync(customer)
    : page === 'cari-hesaplar'
      ? calculateCariHesapFocusAnalysisSync(customer)
      : calculateSevkiyatAnalysisSync(customer);
  const { raw3M, raw6M, raw12M } = trendData.actualPaymentDays;
  const maxDays = Math.max(raw3M, raw6M, raw12M, 1);
  const trendMeta = TREND_META[trendData.trendDirection] || TREND_META.STABLE;

  const methods = [
    { key: 'krediKarti', label: 'Kredi Kartı', pct: trendData.methodPercentages.krediKarti, color: 'var(--cv2-violet)' },
    { key: 'havale', label: 'Havale/EFT', pct: trendData.methodPercentages.havale, color: 'var(--cv2-blue)' },
    { key: 'nakit', label: 'Nakit', pct: trendData.methodPercentages.nakit, color: 'var(--cv2-green)' },
  ];
  // NOT (düzeltme): Müşterinin hiç tahsilat kaydı yoksa getCustomerPaymentTrendSync
  // artık preferredMethod='Veri Yok' ve methodPercentages='—' döndürüyor (önceden
  // sabit/uydurma değerler dönüyordu). Bu durumda stacked-bar grafiği (geçersiz
  // CSS width='—' ile bozuk render olurdu) yerine açık bir "veri yok" mesajı gösteriliyor.
  const hasCollectionData = trendData.preferredMethod !== 'Veri Yok';

  return (
    <section className="cv2-panel active">
      {/* Hero Metric Cards */}
      <div className="cv2-metrics-grid">
        <div className="cv2-metric-card" style={{ ['--mc' as any]: 'var(--cv2-amber)' }}>
          <div className="cv2-metric-chip"><svg className="cv2-ic"><use href="#i-clock" /></svg></div>
          <div className="cv2-metric-lbl">Ortalama Vade</div>
          <div className="cv2-metric-val">{trendData.contractualVade}</div>
          <div className="cv2-metric-sub">Anlaşmalı / açık borç yaşı</div>
        </div>

        <div className="cv2-metric-card" style={{ ['--mc' as any]: 'var(--cv2-green)' }}>
          <div className="cv2-metric-chip"><svg className="cv2-ic"><use href="#i-bolt" /></svg></div>
          <div className="cv2-metric-lbl">3 Aylık Hız</div>
          <div className="cv2-metric-val">{trendData.actualPaymentDays.days3M}</div>
          <div className="cv2-metric-sub">Son 90 gün gerçekleşen</div>
        </div>

        <div className="cv2-metric-card" style={{ ['--mc' as any]: 'var(--cv2-blue)' }}>
          <div className="cv2-metric-chip"><svg className="cv2-ic"><use href="#i-bars" /></svg></div>
          <div className="cv2-metric-lbl">6 Aylık Hız</div>
          <div className="cv2-metric-val">{trendData.actualPaymentDays.days6M}</div>
          <div className="cv2-metric-sub">Son 180 gün ortalama</div>
        </div>

        <div className="cv2-metric-card" style={{ ['--mc' as any]: 'var(--cv2-violet)' }}>
          <div className="cv2-metric-chip"><svg className="cv2-ic"><use href="#i-cal-range" /></svg></div>
          <div className="cv2-metric-lbl">12 Aylık Hız</div>
          <div className="cv2-metric-val">{trendData.actualPaymentDays.days12M}</div>
          <div className="cv2-metric-sub">Son 365 gün yıllık</div>
        </div>
      </div>

      <div className="cv2-split-grid">
        {/* Payment Speed Bar Chart */}
        <div className="cv2-panel-card">
          <div className="cv2-panel-card-head">
            <h3>Ödeme Hızı Trendi</h3>
            <span className="cv2-trend-badge"><span className="dotp" />{trendMeta.label}</span>
          </div>

          <div className="cv2-bar-row">
            <span className="cv2-bar-row-lbl">3 Ay</span>
            <div className="cv2-bar-track"><div className="cv2-bar-fill" style={{ width: `${(raw3M / maxDays) * 100}%` }} /></div>
            <span className="cv2-bar-row-val">{raw3M}g</span>
          </div>
          <div className="cv2-bar-row">
            <span className="cv2-bar-row-lbl">6 Ay</span>
            <div className="cv2-bar-track"><div className="cv2-bar-fill" style={{ width: `${(raw6M / maxDays) * 100}%` }} /></div>
            <span className="cv2-bar-row-val">{raw6M}g</span>
          </div>
          <div className="cv2-bar-row">
            <span className="cv2-bar-row-lbl">12 Ay</span>
            <div className="cv2-bar-track"><div className="cv2-bar-fill" style={{ width: `${(raw12M / maxDays) * 100}%` }} /></div>
            <span className="cv2-bar-row-val">{raw12M}g</span>
          </div>
        </div>

        {/* Payment Method Distribution */}
        <div className="cv2-panel-card">
          <div className="cv2-panel-card-head"><h3>Tahsilat Yöntemi Dağılımı</h3></div>
          {hasCollectionData ? (
            <>
              <div className="cv2-stacked-bar">
                {methods.map(m => (
                  <div key={m.key} className="cv2-stacked-seg" style={{ width: m.pct, background: m.color }} />
                ))}
              </div>
              <div className="cv2-method-legend">
                {methods.map(m => (
                  <div className="cv2-method-row" key={m.key}>
                    <span className="cv2-method-dot" style={{ background: m.color }} />
                    <svg className="cv2-ic" style={{ color: 'var(--cv2-ink-2)' }}><use href={METHOD_ICON[m.key]} /></svg>
                    <span className="cv2-method-name">{m.label}</span>
                    <span className="cv2-method-pct">{m.pct}</span>
                  </div>
                ))}
              </div>
              <div className="cv2-method-foot">En sık kullanılan yöntem: <b>{trendData.preferredMethod}</b></div>
            </>
          ) : (
            <div className="cv2-method-foot">Bu müşteri için henüz tahsilat kaydı bulunmuyor.</div>
          )}
        </div>
      </div>

      {/* AI Insight Box */}
      <div className="cv2-insight-card">
        <div className="cv2-insight-icon"><svg className="cv2-ic"><use href="#i-sparkle" /></svg></div>
        <div className="cv2-insight-body">
          <div className="cv2-insight-title">Günlü Odak Analizi &amp; CFO Öngörüsü</div>

          {/* B5 düzeltmesi: focusAnalysis.metrics artık küçük rozet kartlarıyla
              görünür — önceden yalnızca serbest metin (report1/2/3) içinde geçen
              skor/profil/limit gibi yapılandırılmış sayılar burada da okunabiliyor. */}
          {focusAnalysis.metrics && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {Object.entries(focusAnalysis.metrics)
                .filter(([key, val]) => FOCUS_METRIC_META[key] && val !== undefined && val !== null && val !== '')
                .map(([key, val]) => {
                  const meta = FOCUS_METRIC_META[key];
                  const color = meta.tone ? TONE_COLOR[meta.tone(val)] : 'var(--cv2-ink-0)';
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <span style={{ fontSize: '10px', color: 'var(--cv2-ink-2)', fontWeight: 600 }}>{meta.label}:</span>
                      <span style={{ fontSize: '11px', color, fontWeight: 700 }} className="num">{meta.format(val)}</span>
                    </div>
                  );
                })}
            </div>
          )}

          {focusAnalysis.report1 && <p style={{ whiteSpace: 'pre-wrap', marginBottom: '8px', lineHeight: '1.5' }}>{focusAnalysis.report1}</p>}
          {focusAnalysis.report2 && <p style={{ whiteSpace: 'pre-wrap', marginBottom: '8px', lineHeight: '1.5' }}>{focusAnalysis.report2}</p>}
          {focusAnalysis.report3 && <p style={{ whiteSpace: 'pre-wrap', marginBottom: '8px', lineHeight: '1.5' }}>{focusAnalysis.report3}</p>}
          <hr className="cv2-insight-divider" />
          <p>
            <span className="accent">Ödeme Trendi &amp; Tahmini Tahsilat Süreci:</span> {trendData.riskInsight} Yeni kesilecek faturaların tahsilatının müşterinin son 3 aylık ortalama
            ödeme alışkanlığı olan <span className="accent">{trendData.actualPaymentDays.days3M}</span> içerisinde gerçekleşmesi öngörülmektedir.
          </p>
        </div>
      </div>
    </section>
  );
}
