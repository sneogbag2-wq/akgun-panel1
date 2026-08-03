// src/components/modals/CustomerAnalysisModal.tsx
import { getCustomerPaymentTrendSync, calculateSevkiyatAnalysisSync } from '../../services/customerService';

interface Props {
  customer: any;
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

export default function CustomerAnalysisBody({ customer }: Props) {
  const trendData = getCustomerPaymentTrendSync(customer);
  const sevkiyatAnalysis = calculateSevkiyatAnalysisSync(customer);
  const { raw3M, raw6M, raw12M } = trendData.actualPaymentDays;
  const maxDays = Math.max(raw3M, raw6M, raw12M, 1);
  const trendMeta = TREND_META[trendData.trendDirection] || TREND_META.STABLE;

  const methods = [
    { key: 'krediKarti', label: 'Kredi Kartı', pct: trendData.methodPercentages.krediKarti, color: 'var(--cv2-violet)' },
    { key: 'havale', label: 'Havale/EFT', pct: trendData.methodPercentages.havale, color: 'var(--cv2-blue)' },
    { key: 'nakit', label: 'Nakit', pct: trendData.methodPercentages.nakit, color: 'var(--cv2-green)' },
  ];

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
        </div>
      </div>

      {/* AI Insight Box */}
      <div className="cv2-insight-card">
        <div className="cv2-insight-icon"><svg className="cv2-ic"><use href="#i-sparkle" /></svg></div>
        <div className="cv2-insight-body">
          <div className="cv2-insight-title">Günlü Odak Analizi &amp; CFO Öngörüsü</div>
          {sevkiyatAnalysis.report1 && <p style={{ whiteSpace: 'pre-wrap', marginBottom: '8px', lineHeight: '1.5' }}>{sevkiyatAnalysis.report1}</p>}
          {sevkiyatAnalysis.report2 && <p style={{ whiteSpace: 'pre-wrap', marginBottom: '8px', lineHeight: '1.5' }}>{sevkiyatAnalysis.report2}</p>}
          {sevkiyatAnalysis.report3 && <p style={{ whiteSpace: 'pre-wrap', marginBottom: '8px', lineHeight: '1.5' }}>{sevkiyatAnalysis.report3}</p>}
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
