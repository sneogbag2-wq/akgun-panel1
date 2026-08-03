import React, { useState, useEffect, useMemo } from 'react';
import { getSelloutPerformance, calculateAdvancedSelloutForecast, RepSelloutPerformance, SsmSelloutPerformance } from '../calculations/selloutCalculations';
import { calculateRepFknsBreakdown, RepFknsBreakdown } from '../calculations/fknsCalculations';
import { getRawSelloutDataSync, setHoverAnalyticsData, calculateRepHoverAnalyticsSync } from '../services/customerService';
import { TargetSettingsModal } from '../components/settings/TargetSettingsModal';
import { ModalWrapper } from '../components/common/ModalWrapper';
import { formatNumber } from '../utils/formatters';
import './SelloutHedefPage.css';

function formatLiters(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '0 L';
  return `${formatNumber(Math.round(val))} L`;
}

function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function SelloutHedefPage() {
  const [activeTab, setActiveTab] = useState<'HEDEF' | 'FKNS' | 'SSM'>('HEDEF');
  
  // Smart default month selection: Pick latest month from Sellout data if present
  const [targetMonth, setTargetMonth] = useState<string>(() => {
    try {
      const selloutData = getRawSelloutDataSync();
      if (selloutData && selloutData.length > 0) {
        const dates = selloutData.map((s: any) => s.date).filter(Boolean).sort();
        if (dates.length > 0) {
          const latestDate = dates[dates.length - 1];
          if (latestDate.length >= 7) {
            return latestDate.slice(0, 7);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Filter States
  const [activeRepFilter, setActiveRepFilter] = useState('');
  
  // FKNS specific states
  const [fknsMode, setFknsMode] = useState<'FATURA' | 'URUN'>('FATURA');
  const [productQuery, setProductQuery] = useState('');
  
  // Modal for displaying Uninvoiced Outlets list when clicked
  const [activeUninvoicedModal, setActiveUninvoicedModal] = useState<{
    title: string;
    repName: string;
    channelLabel: string;
    list: { id: string; name: string }[];
  } | null>(null);

  // Data Loading
  const [performanceData, setPerformanceData] = useState<{ ssmList: SsmSelloutPerformance[], companyTotal: SsmSelloutPerformance } | null>(null);
  
  useEffect(() => {
    const load = () => {
      const data = getSelloutPerformance(targetMonth);
      setPerformanceData(data);
    };
    load();
  }, [targetMonth, isSettingsOpen]);

  // Overall Company Totals & Forecast
  const companyMetrics = useMemo(() => {
    if (!performanceData) return null;
    const { companyTotal } = performanceData;
    const forecast = calculateAdvancedSelloutForecast(targetMonth, activeRepFilter);

    const openTarget = companyTotal.openChannelTarget || 0;
    const openRealized = companyTotal.openChannelRealized || 0;
    const openRemaining = Math.max(0, openTarget - openRealized);
    const openPercent = openTarget > 0 ? Math.round((openRealized / openTarget) * 100) : 0;

    const closedTarget = companyTotal.closedChannelTarget || 0;
    const closedRealized = companyTotal.closedChannelRealized || 0;
    const closedRemaining = Math.max(0, closedTarget - closedRealized);
    const closedPercent = closedTarget > 0 ? Math.round((closedRealized / closedTarget) * 100) : 0;

    const totalTarget = companyTotal.totalTarget || 0;
    const totalRealized = companyTotal.totalRealized || 0;
    const totalRemaining = Math.max(0, totalTarget - totalRealized);
    const totalPercent = totalTarget > 0 ? Math.round((totalRealized / totalTarget) * 100) : 0;

    return {
      openTarget, openRealized, openRemaining, openPercent,
      closedTarget, closedRealized, closedRemaining, closedPercent,
      totalTarget, totalRealized, totalRemaining, totalPercent,
      forecast
    };
  }, [performanceData, targetMonth, activeRepFilter]);

  // FKNS Calculations per Representative
  const repFknsList = useMemo(() => {
    if (!performanceData) return [];
    const allReps: string[] = [];
    performanceData.ssmList.forEach(ssm => {
      ssm.reps.forEach(r => allReps.push(r.repName));
    });

    const activeProd = fknsMode === 'URUN' ? productQuery : '';

    const list = allReps.map(repName => {
      if (activeRepFilter && !repName.toLowerCase().includes(activeRepFilter.toLowerCase())) return null;
      return calculateRepFknsBreakdown(repName, activeProd, targetMonth);
    }).filter(Boolean) as RepFknsBreakdown[];

    return list;
  }, [performanceData, fknsMode, productQuery, targetMonth, activeRepFilter]);

  // TAB 1: Hedef Durumu (Temsilci Bazlı Hedef Takip)
  const renderTargetTab = () => {
    if (!performanceData || !companyMetrics) return null;
    const { ssmList } = performanceData;
    const { forecast } = companyMetrics;

    let aiTone: 'healthy' | 'warning' | 'danger' = 'healthy';
    if (forecast.weightedPercent < 85) aiTone = 'danger';
    else if (forecast.weightedPercent < 100) aiTone = 'warning';

    const filteredSsmList = ssmList.map(ssm => {
      if (!activeRepFilter) return ssm;
      const q = activeRepFilter.toLowerCase();
      const ssmMatch = ssm.ssmName.toLowerCase().includes(q);
      const matchingReps = ssm.reps.filter(r => r.repName.toLowerCase().includes(q));
      if (ssmMatch) return ssm;
      if (matchingReps.length > 0) return { ...ssm, reps: matchingReps };
      return null;
    }).filter(Boolean) as SsmSelloutPerformance[];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>
        
        {/* ── 1. HERO OVERVIEW CARDS ── */}
        <div className="sellout-hero-grid">
          {/* Card 1: Açık Kanal */}
          <div className="sellout-kpi-card-v3 open-channel">
            <div className="kpi-v3-header">
              <span className="kpi-v3-title">
                <i className="fa-solid fa-store" style={{ color: '#3B82F6' }}></i>
                Açık Kanal Satış & Hedef
              </span>
              <span className="kpi-v3-badge blue">%{companyMetrics.openPercent} Karşılama</span>
            </div>

            <div className="kpi-v3-body">
              <div className="kpi-v3-main-stat">
                <span className="kpi-v3-number">{formatLiters(companyMetrics.openRealized)}</span>
              </div>

              <div className="kpi-v3-micro-grid">
                <div className="micro-item">
                  <label>Hedef</label>
                  <span>{formatLiters(companyMetrics.openTarget)}</span>
                </div>
                <div className="micro-item">
                  <label>Satış</label>
                  <span className="accent-blue">{formatLiters(companyMetrics.openRealized)}</span>
                </div>
                <div className="micro-item">
                  <label>Kalan</label>
                  <span className="accent-amber">{formatLiters(companyMetrics.openRemaining)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Kapalı Kanal */}
          <div className="sellout-kpi-card-v3 closed-channel">
            <div className="kpi-v3-header">
              <span className="kpi-v3-title">
                <i className="fa-solid fa-utensils" style={{ color: '#8B5CF6' }}></i>
                Kapalı Kanal Satış & Hedef
              </span>
              <span className="kpi-v3-badge purple">%{companyMetrics.closedPercent} Karşılama</span>
            </div>

            <div className="kpi-v3-body">
              <div className="kpi-v3-main-stat">
                <span className="kpi-v3-number">{formatLiters(companyMetrics.closedRealized)}</span>
              </div>

              <div className="kpi-v3-micro-grid">
                <div className="micro-item">
                  <label>Hedef</label>
                  <span>{formatLiters(companyMetrics.closedTarget)}</span>
                </div>
                <div className="micro-item">
                  <label>Satış</label>
                  <span className="accent-[#8B5CF6]">{formatLiters(companyMetrics.closedRealized)}</span>
                </div>
                <div className="micro-item">
                  <label>Kalan</label>
                  <span className="accent-amber">{formatLiters(companyMetrics.closedRemaining)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: PROMINENT HERO TOTAL REALIZATION RING CARD */}
          <div className="sellout-kpi-card-v3 hero-total">
            <div className="kpi-v3-header">
              <span className="kpi-v3-title">
                <i className="fa-solid fa-chart-line" style={{ color: '#10B981' }}></i>
                Genel Toplam Hedef Gerçekleşme
              </span>
              <span className="kpi-v3-badge green">Genel Oran</span>
            </div>

            <div className="hero-total-box">
              <div 
                className="hero-percent-ring"
                style={{ '--pg-var': `${Math.min(100, companyMetrics.totalPercent)}%` } as React.CSSProperties}
              >
                <span className="hero-percent-text">%{companyMetrics.totalPercent}</span>
              </div>

              <div className="hero-details-list">
                <div className="hero-detail-row">
                  <label>Toplam Hedef:</label>
                  <span>{formatLiters(companyMetrics.totalTarget)}</span>
                </div>
                <div className="hero-detail-row">
                  <label>Toplam Satış:</label>
                  <span style={{ color: '#3DDC9A' }}>{formatLiters(companyMetrics.totalRealized)}</span>
                </div>
                <div className="hero-detail-row">
                  <label>Toplam Kalan:</label>
                  <span style={{ color: '#F6BB4D' }}>{formatLiters(companyMetrics.totalRemaining)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. CFO & AI FORECAST ROW ── */}
        <div className="sellout-cfo-row">
          <div className="cfo-stats-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F6F8FC' }}>
                <i className="fa-solid fa-gauge-high" style={{ color: '#F59E0B', marginRight: '6px' }}></i>
                Satış Hızı & Dönemsel Tahmin
              </span>
              <span className={`sellout-badge ${aiTone}`}>
                {aiTone === 'healthy' ? '🟢 Hedef Tutar!' : aiTone === 'warning' ? '🟡 Risk Altında' : '🔴 Hedef Sapması'}
              </span>
            </div>

            <div className="cfo-stats-grid">
              <div className="cfo-stat-box">
                <label>Günlük Satış Hızı</label>
                <span className="val">{formatLiters(forecast.dailyVelocity)}/G</span>
                {forecast.requiredDailyVelocity > 0 && (
                  <span className="sub" style={{ color: '#F59E0B' }}>Gerekli: {formatLiters(forecast.requiredDailyVelocity)}/G</span>
                )}
              </div>

              <div className="cfo-stat-box">
                <label>Dönemsel CFO Tahmini</label>
                <span className="val">{formatLiters(forecast.weightedForecast)}</span>
                <span className="sub" style={{ color: forecast.weightedPercent >= 100 ? '#3DDC9A' : '#FB7B85' }}>
                  %{forecast.weightedPercent} Kapanış (Düz: %{forecast.linearPercent})
                </span>
              </div>
            </div>
          </div>

          <div className="cfo-ai-comment-card">
            <div className="cfo-ai-comment-header">
              <h4>
                <i className="fa-solid fa-brain" style={{ color: '#A78BFA' }}></i>
                Günlü CFO Analizi & Dönemsellik Yorumu
              </h4>
              <span style={{ fontSize: '0.75rem', color: '#9BA6BC' }}>
                Tarihsel İvme: <strong>%{Math.round(forecast.historicalSeasonalityRatio * 100)}</strong> • Son 10 Gün Sıçrama: <strong>%{Math.round(forecast.lateMonthSpikeRatio * 100)}</strong>
              </span>
            </div>
            <p className="cfo-ai-comment-text">
              {forecast.cfoCommentary}
            </p>
          </div>
        </div>

        {/* ── 3. MODERN REPRESENTATIVE CARDS GRID SECTION ── */}
        <div className="sellout-rep-section">
          <div className="sellout-section-header">
            <h3 className="sellout-section-title">
              <i className="fa-solid fa-users" style={{ color: '#3B82F6' }}></i>
              Geleneksel Kanal Satış Hedef Takip
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#9BA6BC' }}>
              Toplam {filteredSsmList.length} Bölge • {filteredSsmList.reduce((a, b) => a + b.reps.length, 0)} Temsilci
            </span>
          </div>

          {filteredSsmList.map(ssm => {
            const ssmPercent = ssm.totalTarget > 0 ? Math.round((ssm.totalRealized / ssm.totalTarget) * 100) : 0;
            return (
              <div key={`ssm-group-${ssm.ssmName}`} className="ssm-group-card">
                <div className="ssm-group-header">
                  <div className="ssm-title-wrap">
                    <div className="ssm-icon-badge">
                      <i className="fa-solid fa-building"></i>
                    </div>
                    <div>
                      <div className="ssm-name">{ssm.ssmName}</div>
                      <span style={{ fontSize: '0.75rem', color: '#9BA6BC' }}>Bölge Yöneticisi Grubu</span>
                    </div>
                  </div>

                  <div className="ssm-summary-stats">
                    <div className="ssm-summary-stat-item">
                      <span>Açık:</span>
                      <strong>{formatLiters(ssm.openChannelRealized)}</strong>
                    </div>
                    <div className="ssm-summary-stat-item">
                      <span>Kapalı:</span>
                      <strong>{formatLiters(ssm.closedChannelRealized)}</strong>
                    </div>
                    <div className="ssm-summary-stat-item">
                      <span>Toplam Satış:</span>
                      <strong style={{ color: '#3DDC9A' }}>{formatLiters(ssm.totalRealized)}</strong>
                      <span style={{ color: '#5C6479' }}>/ {formatLiters(ssm.totalTarget)}</span>
                    </div>
                    <span className={`rep-percent-badge ${ssmPercent >= 90 ? 'high' : ssmPercent >= 50 ? 'mid' : 'low'}`}>
                      %{ssmPercent} Target
                    </span>
                  </div>
                </div>

                <div className="rep-cards-grid">
                  {ssm.reps.map(rep => {
                    const repPercent = rep.totalTarget > 0 ? Math.round((rep.totalRealized / rep.totalTarget) * 100) : 0;
                    const openRepPercent = rep.openChannelTarget > 0 ? Math.round((rep.openChannelRealized / rep.openChannelTarget) * 100) : 0;
                    const closedRepPercent = rep.closedChannelTarget > 0 ? Math.round((rep.closedChannelRealized / rep.closedChannelTarget) * 100) : 0;

                    return (
                      <div 
                        key={`rep-card-${rep.repName}`} 
                        className="rep-card"
                        onMouseEnter={(e) => setHoverAnalyticsData({
                          ...calculateRepHoverAnalyticsSync(rep.repName, targetMonth),
                          targetRect: e.currentTarget.getBoundingClientRect()
                        } as any)}
                        onMouseLeave={() => setHoverAnalyticsData(null)}
                      >
                        <div className="rep-card-top">
                          <div className="rep-user-info">
                            <div className="rep-avatar">
                              {getInitials(rep.repName)}
                            </div>
                            <div className="rep-name">{rep.repName}</div>
                          </div>
                          <span className={`rep-percent-badge ${repPercent >= 90 ? 'high' : repPercent >= 50 ? 'mid' : 'low'}`}>
                            %{repPercent}
                          </span>
                        </div>

                        <div className="rep-card-main-stat">
                          <span className="rep-stat-label">Toplam Satış / Hedef</span>
                          <div className="rep-stat-val-row">
                            <span className="rep-big-num">{formatLiters(rep.totalRealized)}</span>
                            <span className="rep-target-num">/ {formatLiters(rep.totalTarget)}</span>
                          </div>
                        </div>

                        <div className="rep-progress-track">
                          <div 
                            className="rep-progress-fill" 
                            style={{ width: `${Math.min(100, repPercent)}%` }} 
                          />
                        </div>

                        <div className="rep-channels-grid">
                          <div className="rep-channel-box">
                            <label>Açık Kanal</label>
                            <span className="rep-channel-val open">
                              {formatLiters(rep.openChannelRealized)}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#5C6479' }}>
                              %{openRepPercent} (Hedef: {formatLiters(rep.openChannelTarget)})
                            </span>
                          </div>

                          <div className="rep-channel-box">
                            <label>Kapalı Kanal</label>
                            <span className="rep-channel-val closed">
                              {formatLiters(rep.closedChannelRealized)}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#5C6479' }}>
                              %{closedRepPercent} (Hedef: {formatLiters(rep.closedChannelTarget)})
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // TAB 2: FKNS & Ürün Penetrasyonu (Rep-based Card Grid with Uninvoiced Click List)
  const renderFknsTab = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>
        {/* Mode Switcher & Product Filter Header */}
        <div style={{ display: 'flex', justifyBetween: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div className="sellout-mode-switcher">
            <button 
              className={`sellout-mode-btn ${fknsMode === 'FATURA' ? 'active' : ''}`}
              onClick={() => setFknsMode('FATURA')}
            >
              <i className="fa-solid fa-file-invoice" style={{ marginRight: '6px' }}></i>
              Fatura Bazlı FKNS
            </button>
            <button 
              className={`sellout-mode-btn ${fknsMode === 'URUN' ? 'active' : ''}`}
              onClick={() => setFknsMode('URUN')}
            >
              <i className="fa-solid fa-[#3B82F6] fa-box" style={{ marginRight: '6px' }}></i>
              Ürün Bazlı Penetrasyon
            </button>
          </div>

          {fknsMode === 'URUN' && (
            <div className="sellout-search-wrap" style={{ flex: 1, maxWidth: '360px' }}>
              <i className="fa-solid fa-search sellout-search-icon"></i>
              <input 
                type="text" 
                placeholder="Ürün Kodu veya Adı Girin (Örn: Malt, 152101)..."
                className="sellout-filter-input has-icon"
                style={{ width: '100%', boxSizing: 'border-box' }}
                value={productQuery}
                onChange={e => setProductQuery(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Rep FKNS Cards Grid */}
        <div className="rep-cards-grid">
          {repFknsList.map(repFkns => {
            const isProd = fknsMode === 'URUN';
            const openUninvoicedCount = repFkns.openChannel.uninvoicedList.length;
            const closedUninvoicedCount = repFkns.closedChannel.uninvoicedList.length;

            return (
              <div key={`fkns-card-${repFkns.salesRep}`} className="rep-card">
                <div className="rep-card-top">
                  <div className="rep-user-info">
                    <div className="rep-avatar">
                      {getInitials(repFkns.salesRep)}
                    </div>
                    <div>
                      <div className="rep-name">{repFkns.salesRep}</div>
                      <span style={{ fontSize: '0.72rem', color: '#9BA6BC' }}>
                        {isProd ? (productQuery ? `Ürün: "${productQuery}"` : 'Tüm Ürünler') : 'Genel Fatura FKNS'}
                      </span>
                    </div>
                  </div>

                  {/* Top-Right Overall FKNS Badge (Clean without text 'genel toplam') */}
                  <span className={`rep-percent-badge ${repFkns.overallPercentage >= 80 ? 'high' : repFkns.overallPercentage >= 50 ? 'mid' : 'low'}`}>
                    %{repFkns.overallPercentage}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="rep-progress-track">
                  <div className="rep-progress-fill" style={{ width: `${Math.min(100, repFkns.overallPercentage)}%` }} />
                </div>

                {/* Open vs Closed Channel FKNS Micro Stats */}
                <div className="rep-channels-grid">
                  <div className="rep-channel-box">
                    <label>Açık Kanal FKNS</label>
                    {(repFkns.openChannel as any).isRelevant === false ? (
                      <span className="rep-channel-val" style={{ color: '#5C6479', fontSize: '0.75rem', marginTop: '2px' }}>İlgisiz Kanal</span>
                    ) : (
                      <>
                        <span className="rep-channel-val open">%{repFkns.openChannel.percentage}</span>
                        <span style={{ fontSize: '0.7rem', color: '#5C6479' }}>
                          ({repFkns.openChannel.invoiced} / {repFkns.openChannel.total} Nokta)
                        </span>
                      </>
                    )}
                  </div>

                  <div className="rep-channel-box">
                    <label>Kapalı Kanal FKNS</label>
                    {(repFkns.closedChannel as any).isRelevant === false ? (
                      <span className="rep-channel-val" style={{ color: '#5C6479', fontSize: '0.75rem', marginTop: '2px' }}>İlgisiz Kanal</span>
                    ) : (
                      <>
                        <span className="rep-channel-val closed">%{repFkns.closedChannel.percentage}</span>
                        <span style={{ fontSize: '0.7rem', color: '#5C6479' }}>
                          ({repFkns.closedChannel.invoiced} / {repFkns.closedChannel.total} Nokta)
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Clickable Uninvoiced Badges at Bottom (Pinned) */}
                <div className="rep-card-footer-buttons">
                  <button 
                    className={`fkns-uninvoiced-btn ${openUninvoicedCount === 0 ? 'disabled' : ''}`}
                    disabled={openUninvoicedCount === 0}
                    onClick={() => openUninvoicedCount > 0 && setActiveUninvoicedModal({
                      title: isProd ? 'Ürün Almayan Açık Kanal Noktaları' : 'Fatura Kesilmeyen Açık Kanal Noktaları',
                      repName: repFkns.salesRep,
                      channelLabel: 'Açık Kanal',
                      list: repFkns.openChannel.uninvoicedList
                    })}
                  >
                    <span>⚠️ Açık Kanal Kesilmeyen</span>
                    <span>{openUninvoicedCount} Nokta {openUninvoicedCount > 0 ? '›' : ''}</span>
                  </button>

                  <button 
                    className={`fkns-uninvoiced-btn ${closedUninvoicedCount === 0 ? 'disabled' : ''}`}
                    disabled={closedUninvoicedCount === 0}
                    onClick={() => closedUninvoicedCount > 0 && setActiveUninvoicedModal({
                      title: isProd ? 'Ürün Almayan Kapalı Kanal Noktaları' : 'Fatura Kesilmeyen Kapalı Kanal Noktaları',
                      repName: repFkns.salesRep,
                      channelLabel: 'Kapalı Kanal',
                      list: repFkns.closedChannel.uninvoicedList
                    })}
                  >
                    <span>⚠️ Kapalı Kanal Kesilmeyen</span>
                    <span>{closedUninvoicedCount} Nokta {closedUninvoicedCount > 0 ? '›' : ''}</span>
                  </button>
                </div>
              </div>
            );
          })}

          {repFknsList.length === 0 && (
            <div className="ssm-group-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', color: '#5C6479' }}>
              <i className="fa-solid fa-folder-open" style={{ fontSize: '2rem', marginBottom: '8px', opacity: 0.5 }}></i>
              Filtrelere uygun FKNS verisi bulunamadı.
            </div>
          )}
        </div>
      </div>
    );
  };

  // TAB 3: SSM Hedef Takip (SSM Overview Cards)
  const renderSsmTab = () => {
    if (!performanceData) return null;
    const { ssmList } = performanceData;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>
        <div className="ssm-cards-grid">
          {ssmList.map(ssm => {
            const ssmPercent = ssm.totalTarget > 0 ? Math.round((ssm.totalRealized / ssm.totalTarget) * 100) : 0;
            const remaining = Math.max(0, ssm.totalTarget - ssm.totalRealized);
            const openPct = ssm.openChannelTarget > 0 ? Math.round((ssm.openChannelRealized / ssm.openChannelTarget) * 100) : 0;
            const closedPct = ssm.closedChannelTarget > 0 ? Math.round((ssm.closedChannelRealized / ssm.closedChannelTarget) * 100) : 0;

            return (
              <div key={`ssm-hero-${ssm.ssmName}`} className="ssm-hero-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="ssm-icon-badge" style={{ width: '42px', height: '42px', fontSize: '1.2rem' }}>
                      <i className="fa-solid fa-building"></i>
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F6F8FC', margin: 0 }}>
                        {ssm.ssmName}
                      </h3>
                      <span style={{ fontSize: '0.78rem', color: '#9BA6BC' }}>
                        {ssm.reps.length} Satış Temsilcisi
                      </span>
                    </div>
                  </div>

                  <div 
                    className="hero-percent-ring"
                    style={{ width: '70px', height: '70px', '--pg-var': `${Math.min(100, ssmPercent)}%` } as React.CSSProperties}
                  >
                    <span className="hero-percent-text" style={{ fontSize: '1.15rem' }}>%{ssmPercent}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#5C6479', textTransform: 'uppercase' }}>
                    Bölge Toplam Satış / Hedef
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '1.6rem', fontWeight: 900, color: '#FFFFFF' }}>{formatLiters(ssm.totalRealized)}</span>
                    <span style={{ fontSize: '0.85rem', color: '#5C6479' }}>/ {formatLiters(ssm.totalTarget)}</span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: '#F6BB4D', fontWeight: 600 }}>
                    Kalan Hedef: {formatLiters(remaining)}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="rep-progress-track" style={{ height: '8px' }}>
                  <div className="rep-progress-fill" style={{ width: `${Math.min(100, ssmPercent)}%` }} />
                </div>

                {/* Channels Micro Grid */}
                <div className="kpi-v3-micro-grid">
                  <div className="micro-item">
                    <label>Açık Kanal Satış</label>
                    <span className="accent-blue">{formatLiters(ssm.openChannelRealized)}</span>
                    <span style={{ fontSize: '0.7rem', color: '#5C6479' }}>%{openPct} Karşılama</span>
                  </div>

                  <div className="micro-item">
                    <label>Kapalı Kanal Satış</label>
                    <span className="accent-[#8B5CF6]">{formatLiters(ssm.closedChannelRealized)}</span>
                    <span style={{ fontSize: '0.7rem', color: '#5C6479' }}>%{closedPct} Karşılama</span>
                  </div>

                  <div className="micro-item">
                    <label>Temsilci Sayısı</label>
                    <span>{ssm.reps.length} Kişi</span>
                  </div>
                </div>

                {/* Sub Reps List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#5C6479', textTransform: 'uppercase' }}>
                    Bölge Temsilcileri Performance
                  </span>
                  {ssm.reps.map(r => {
                    const rPct = r.totalTarget > 0 ? Math.round((r.totalRealized / r.totalTarget) * 100) : 0;
                    return (
                      <div key={`ssm-sub-rep-${r.repName}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                        <span style={{ color: '#9BA6BC' }}>{r.repName}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#F6F8FC', fontWeight: 700 }}>{formatLiters(r.totalRealized)}</span>
                          <span className={`rep-percent-badge ${rPct >= 90 ? 'high' : rPct >= 50 ? 'mid' : 'low'}`} style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                            %{rPct}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="sellout-page-wrap">
      {/* Target Settings Modal for Admin */}
      <TargetSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Modal for Uninvoiced Customer List */}
      {activeUninvoicedModal && (
        <ModalWrapper 
          isOpen={!!activeUninvoicedModal} 
          onClose={() => setActiveUninvoicedModal(null)}
          title={`${activeUninvoicedModal.repName} — ${activeUninvoicedModal.title}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
            <div style={{ fontSize: '0.85rem', color: '#9BA6BC', borderBottom: '1px solid rgba(255,255,255,0.06)', pb: '8px' }}>
              Kanal: <strong>{activeUninvoicedModal.channelLabel}</strong> • Toplam <strong>{activeUninvoicedModal.list.length} Nokta</strong> fatura almadı.
            </div>

            <table className="sellout-table">
              <thead>
                <tr>
                  <th>Müşteri Kodu</th>
                  <th>Müşteri Unvanı / Tabela</th>
                </tr>
              </thead>
              <tbody>
                {activeUninvoicedModal.list.map(c => (
                  <tr key={c.id}>
                    <td className="num" style={{ color: '#9BA6BC', fontSize: '0.8rem' }}>{c.id}</td>
                    <td style={{ color: '#E2E8F0', fontWeight: 500 }}>{c.name}</td>
                  </tr>
                ))}
                {activeUninvoicedModal.list.length === 0 && (
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'center', padding: '24px', color: '#5C6479' }}>
                      Tüm noktalara ulaşılmış!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ModalWrapper>
      )}

      {/* Header & Controls */}
      <div className="sellout-header">
        <div className="sellout-title-box">
          <h1>Geleneksel Kanal Satış Hedef Takip</h1>
          <p>Temsilci ve SSM hedef gerçekleşmeleri, litre kırılımları ve FKNS oranları.</p>
        </div>

        <div className="sellout-top-controls">
          <input 
            type="month" 
            value={targetMonth}
            onChange={(e) => setTargetMonth(e.target.value)}
            className="sellout-date-input"
          />
          
          <div className="sellout-search-wrap">
            <i className="fa-solid fa-search sellout-search-icon"></i>
            <input 
              type="text" 
              placeholder="Temsilci Filtresi..."
              className="sellout-filter-input has-icon"
              value={activeRepFilter}
              onChange={(e) => setActiveRepFilter(e.target.value)}
            />
          </div>

          <button 
            className="sellout-btn-primary"
            onClick={() => setIsSettingsOpen(true)}
          >
            <i className="fa-solid fa-sliders"></i> Hedefleri Yönet
          </button>
        </div>
      </div>

      {/* 3 Tabs Bar */}
      <div className="sellout-tabs-bar">
        <button 
          className={`sellout-tab-btn ${activeTab === 'HEDEF' ? 'active' : ''}`}
          onClick={() => setActiveTab('HEDEF')}
        >
          <i className="fa-solid fa-bullseye"></i> Hedef Durumu
        </button>
        <button 
          className={`sellout-tab-btn ${activeTab === 'FKNS' ? 'active' : ''}`}
          onClick={() => setActiveTab('FKNS')}
        >
          <i className="fa-solid fa-chart-pie"></i> FKNS & Ürün Penetrasyonu
        </button>
        <button 
          className={`sellout-tab-btn ${activeTab === 'SSM' ? 'active' : ''}`}
          onClick={() => setActiveTab('SSM')}
        >
          <i className="fa-solid fa-building"></i> SSM Hedef Takip
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'HEDEF' && renderTargetTab()}
        {activeTab === 'FKNS' && renderFknsTab()}
        {activeTab === 'SSM' && renderSsmTab()}
      </div>
    </div>
  );
}
