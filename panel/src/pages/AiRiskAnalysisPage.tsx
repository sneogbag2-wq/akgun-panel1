import React, { useState, useEffect, useMemo } from 'react';
import { 
  getGlobalFinancialSummarySync,
  getParetoConcentrationAnalysisSync,
  getCollectionEffectivenessIndexSync,
  getFinancialHealthReportSync,
  getAllCustomersForReportingSync,
  getCurrentMonthMetricsSync,
  getOverdueCustomersListSync,
  subscribeDataChange,
  triggerOpenCustomerModal
} from '../services/customerService';
import { formatCurrency } from '../utils/formatters';
import { MascotAvatar } from '../components/ai/MascotAvatar';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie } from 'recharts';
import './AiRiskAnalysisPage.css';

export default function AiRiskAnalysisPage() {
  const [dataVersion, setDataVersion] = useState(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'aging' | 'pareto' | 'cei' | 'table'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'NORMAL'>('ALL');
  const [timeRange, setTimeRange] = useState<'30d' | 'today' | 'forecast'>('today');

  useEffect(() => {
    return subscribeDataChange(() => {
      setDataVersion(prev => prev + 1);
    });
  }, []);

  const globalSummary = useMemo(() => getGlobalFinancialSummarySync(), [dataVersion]);
  const finHealthData = useMemo(() => getFinancialHealthReportSync(searchQuery), [dataVersion, searchQuery]);
  const paretoData = useMemo(() => getParetoConcentrationAnalysisSync(), [dataVersion]);
  const ceiData = useMemo(() => getCollectionEffectivenessIndexSync(searchQuery), [dataVersion, searchQuery]);
  const currentMonthMetrics = useMemo(() => getCurrentMonthMetricsSync(), [dataVersion]);
  const allCustomers = useMemo(() => getAllCustomersForReportingSync(), [dataVersion]);
  const overdue90List = useMemo(() => getOverdueCustomersListSync(90), [dataVersion]);

  // Exact metrics computations without data loss
  const coverageMonths = useMemo(() => {
    const monthlyCols = currentMonthMetrics.monthCollections || 0;
    if (monthlyCols <= 0) return null;
    return (globalSummary.totalNetReceivables || 0) / monthlyCols;
  }, [globalSummary, currentMonthMetrics]);

  const totalOverdue = useMemo(() => {
    if (!finHealthData.agingDistribution) return 0;
    return (finHealthData.agingDistribution.days30 || 0) +
           (finHealthData.agingDistribution.days60 || 0) +
           (finHealthData.agingDistribution.days90Plus || 0);
  }, [finHealthData]);

  const ceiVal = ceiData.rawCEI ?? 0;
  const paretoVal = paretoData.debtPareto?.customerRatioPercentage ?? "0";
  const inflationDrag = (totalOverdue || 0) * 0.045; // Aylık %4.5 enflasyon maliyet aşınması

  // Filtered customers table list
  const filteredCustomerList = useMemo(() => {
    let list = allCustomers.map(c => {
      const balance = c.balance || c.totalBalance || c.openBalance || 0;
      const overdue = c.overdueBalance || c.overdueTotal || 0;
      let level: 'HIGH' | 'MEDIUM' | 'NORMAL' = 'NORMAL';
      if (overdue > 50000) level = 'HIGH';
      else if (overdue > 0) level = 'MEDIUM';
      
      return {
        ...c,
        calculatedBalance: balance,
        calculatedOverdue: overdue,
        riskLevel: level
      };
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => 
        (c.customerName && c.customerName.toLowerCase().includes(q)) ||
        (c.signName && c.signName.toLowerCase().includes(q)) ||
        (c.customerId && c.customerId.toLowerCase().includes(q)) ||
        (c.salesRepName && c.salesRepName.toLowerCase().includes(q))
      );
    }

    if (riskFilter !== 'ALL') {
      list = list.filter(c => c.riskLevel === riskFilter);
    }

    list.sort((a, b) => b.calculatedOverdue - a.calculatedOverdue || b.calculatedBalance - a.calculatedBalance);
    return list;
  }, [allCustomers, searchQuery, riskFilter]);

  // Aging distribution chart data
  const agingChartData = useMemo(() => {
    const dist = finHealthData.agingDistribution || { current: 0, days30: 0, days60: 0, days90Plus: 0 };
    return [
      { name: '0 - 30 Gün (Cari)', amount: dist.current || 0, color: '#14B8A6', count: dist.currentCustCount || 0 },
      { name: '31 - 60 Gün Gecikme', amount: dist.days30 || 0, color: '#F59E0B', count: dist.days30CustCount || 0 },
      { name: '61 - 90+ Gün Kritik', amount: (dist.days60 || 0) + (dist.days90Plus || 0), color: '#F43F5E', count: dist.days60PlusCustCount || 0 }
    ];
  }, [finHealthData]);

  // CEI payment methods donut data
  const paymentBreakdownData = useMemo(() => {
    return ceiData.paymentMethodBreakdown || [];
  }, [ceiData]);

  const cleanName = (n: string) => {
    if (!n) return '';
    const words = n.trim().split(/\s+/);
    const unique: string[] = [];
    for (const w of words) {
      if (!unique.some(x => x.toLowerCase() === w.toLowerCase())) {
        unique.push(w);
      }
    }
    return unique.join(' ');
  };

  const handleQuickQuestion = (promptText: string) => {
    window.dispatchEvent(new CustomEvent('open-ai-chat', { detail: { prompt: promptText } }));
  };

  const healthScore = finHealthData.healthScore ?? 78;

  return (
    <div className="ai-risk-container">
      {/* 1. App Header with Timeline Slider & Brand */}
      <header className="radial-app-header">
        <div className="radial-brand-box">
          <div className="radial-brand-icon">
            <MascotAvatar size="small" />
          </div>
          <div className="radial-brand-text">
            <h1>
              Günlü AI Finansal Risk Analizi
              <span className="radial-live-status">
                <div className="radial-pulse-dot"></div> CFO AI Aktif
              </span>
            </h1>
            <div className="radial-subtitle">
              Kurumsal Risk Portföyü, CEI İndeksi, Yaşlandırma & Pareto Analiz Hub'ı
            </div>
          </div>
        </div>

        {/* Timeline Slider Buttons */}
        <div className="radial-timeline-bar">
          <button 
            className={`timeline-btn ${timeRange === '30d' ? 'active' : ''}`}
            onClick={() => setTimeRange('30d')}
          >
            Son 30 Gün
          </button>
          <button 
            className={`timeline-btn ${timeRange === 'today' ? 'active' : ''}`}
            onClick={() => setTimeRange('today')}
          >
            Bugün (Canlı)
          </button>
          <button 
            className={`timeline-btn ${timeRange === 'forecast' ? 'active' : ''}`}
            onClick={() => setTimeRange('forecast')}
          >
            AI 90 Gün Tahmin
          </button>
        </div>

        <div className="radial-header-actions">
          <button className="radial-btn" onClick={() => window.print()}>
            <i className="fa-solid fa-print"></i> Raporu Yazdır
          </button>
          <button className="radial-btn purple" onClick={() => handleQuickQuestion('Şirket genelinde vadesi 90 günü geçen tüm alacakları listeleyip risk raporu çıkarır mısın?')}>
            <i className="fa-solid fa-wand-magic-sparkles"></i> AI Risk Analizi Al
          </button>
        </div>
      </header>

      {/* 2. Control Bar & Search Filter */}
      <div className="radial-control-bar">
        <div className="radial-search-box">
          <i className="fa-solid fa-magnifying-glass" style={{ color: '#94A3B8' }}></i>
          <input 
            type="text"
            placeholder="Müşteri adı, unvanı, kodu veya temsilci ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <i 
              className="fa-solid fa-xmark" 
              style={{ cursor: 'pointer', color: '#94A3B8' }}
              onClick={() => setSearchQuery('')}
            ></i>
          )}
        </div>

        <div className="radial-filter-pills">
          <button 
            className={`radial-pill-btn ${riskFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setRiskFilter('ALL')}
          >
            Tüm Cari Portföy ({allCustomers.length})
          </button>
          <button 
            className={`radial-pill-btn ${riskFilter === 'HIGH' ? 'active' : ''}`}
            style={{ color: '#F87171' }}
            onClick={() => setRiskFilter('HIGH')}
          >
            🚨 Kritik Risk ({allCustomers.filter(c => (c.overdueBalance || 0) > 50000).length})
          </button>
          <button 
            className={`radial-pill-btn ${riskFilter === 'MEDIUM' ? 'active' : ''}`}
            style={{ color: '#FBBF24' }}
            onClick={() => setRiskFilter('MEDIUM')}
          >
            ⚠️ Orta Risk ({allCustomers.filter(c => (c.overdueBalance || 0) > 0 && (c.overdueBalance || 0) <= 50000).length})
          </button>
          <button 
            className={`radial-pill-btn ${riskFilter === 'NORMAL' ? 'active' : ''}`}
            style={{ color: '#2DD4BF' }}
            onClick={() => setRiskFilter('NORMAL')}
          >
            ✅ Normal ({allCustomers.filter(c => (c.overdueBalance || 0) <= 0).length})
          </button>
        </div>
      </div>

      {/* 3. Executive AI CFO Briefing Banner */}
      <div className="radial-cfo-banner">
        <div className="radial-cfo-head">
          <div className="radial-cfo-title">
            <i className="fa-solid fa-brain" style={{ fontSize: '18px' }}></i> Günlü Akıllı CFO Finansal Risk Değerlendirmesi
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {finHealthData.riskLevel && (
              <span className="radial-chip-item" style={{ backgroundColor: finHealthData.riskColor || '#6366F1', color: '#FFF', fontWeight: 700 }}>
                {finHealthData.riskLevel}
              </span>
            )}
            <span className="radial-chip-item purple">
              Sağlık Skoru: {healthScore} / 100
            </span>
          </div>
        </div>

        <p className="radial-cfo-text">
          {searchQuery ? `"${searchQuery}" filtresine göre: ` : 'Şirket genelinde '} 
          toplam <strong>{formatCurrency(finHealthData.netReceivables ?? globalSummary.totalNetReceivables)}</strong> net alacak bulunmakta. 
          Vadesi geçen borç riski <strong>{formatCurrency(totalOverdue)}</strong> (Gecikme Oranı: <strong>%{((finHealthData.overdueRatio ?? 0) * 100).toFixed(1)}</strong>) tutarındadır. 
          Tahsilat Etkinlik İndeksi (CEI) <strong>%{ceiVal.toFixed(1)}</strong> seviyesindedir. 
          Geciken bakiyelerin aylık tahmini enflasyonel drag maliyet aşınması <strong>{formatCurrency(inflationDrag)}</strong> seviyesindedir.
        </p>

        {finHealthData.actionRecommendation && (
          <div style={{ marginTop: '8px', fontSize: '0.84rem', color: '#CBD5E1', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
            💡 <strong>Önerilen CFO Aksiyonu:</strong> {finHealthData.actionRecommendation}
          </div>
        )}

        <div className="radial-cfo-chips-row">
          <div className="radial-chip-item blue">
            <i className="fa-solid fa-wallet"></i> Net Alacak: {formatCurrency(globalSummary.totalNetReceivables)}
          </div>
          <div className="radial-chip-item rose">
            <i className="fa-solid fa-triangle-exclamation"></i> Vadesi Geçen: {formatCurrency(totalOverdue)}
          </div>
          <div className="radial-chip-item teal">
            <i className="fa-solid fa-circle-check"></i> CEI İndeksi: %{ceiVal.toFixed(1)}
          </div>
          <div className="radial-chip-item purple">
            <i className="fa-solid fa-chart-pie"></i> Pareto Yoğunlaşması: {paretoVal}
          </div>
          <div className="radial-chip-item amber">
            <i className="fa-solid fa-fire"></i> Enflasyon Drag Maliyeti: {formatCurrency(inflationDrag)}
          </div>
        </div>
      </div>

      {/* 4. RADIAL HERO CANVAS */}
      <div className="radial-hero-canvas">
        {/* Left Side Metrics Orbit */}
        <div className="radial-side-card">
          <div>
            <div className="radial-metric-lbl">
              <i className="fa-solid fa-wallet" style={{ color: '#3B82F6' }}></i> Net Alacak Bakiyesi
            </div>
            <div className="radial-metric-val" style={{ color: '#FFF' }}>
              {formatCurrency(globalSummary.totalNetReceivables)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#2DD4BF', marginTop: '2px' }}>
              <i className="fa-solid fa-arrow-down"></i> Toplanacak Bakiye
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)' }} />

          <div>
            <div className="radial-metric-lbl">
              <i className="fa-solid fa-clock" style={{ color: '#FBBF24' }}></i> Ağırlıklı Ortalama Vade
            </div>
            <div className="radial-metric-val" style={{ color: '#FBBF24' }}>
              {finHealthData.agingDistribution?.averageVade || 0} Gün
            </div>
            <div style={{ fontSize: '0.75rem', color: '#F87171', marginTop: '2px' }}>
              <i className="fa-solid fa-arrow-up"></i> Ortalama Ödeme Vadesi
            </div>
          </div>
        </div>

        {/* Center Hub: Concentric Health Dial */}
        <div className="radial-dial-box">
          <div className="dial-circle-outer">
            <div className="dial-circle-inner">
              <div className="dial-score-num">{healthScore}</div>
              <div style={{ fontSize: '0.68rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>
                Sağlık Skoru
              </div>
            </div>
          </div>
          <div style={{ marginTop: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>
              Kurumsal Finansal Sağlık: <span style={{ color: healthScore >= 65 ? '#2DD4BF' : healthScore >= 40 ? '#FBBF24' : '#F87171' }}>
                {healthScore >= 65 ? 'Güçlü' : healthScore >= 40 ? 'Orta Risk' : 'Kritik Risk'}
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '2px' }}>
              Likidite, CEI tahsilat hızı ve risk parametreleri dengelendi.
            </p>
          </div>
        </div>

        {/* Right Side Metrics Orbit */}
        <div className="radial-side-card">
          <div>
            <div className="radial-metric-lbl">
              <i className="fa-solid fa-bolt" style={{ color: '#2DD4BF' }}></i> Tahsilat Etkinliği (CEI)
            </div>
            <div className="radial-metric-val" style={{ color: '#2DD4BF' }}>
              %{ceiVal.toFixed(1)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#2DD4BF', marginTop: '2px' }}>
              <i className="fa-solid fa-check"></i> Tahsilat Etkinlik İndeksi
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)' }} />

          <div>
            <div className="radial-metric-lbl">
              <i className="fa-solid fa-fire" style={{ color: '#F87171' }}></i> Enflasyon Drag Yükü
            </div>
            <div className="radial-metric-val" style={{ color: '#F87171' }}>
              {formatCurrency(inflationDrag)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#F87171', marginTop: '2px' }}>
              <i className="fa-solid fa-triangle-exclamation"></i> Aylık %4.5 Parasal Eritme
            </div>
          </div>
        </div>
      </div>

      {/* 5. Navigation Tab Bar */}
      <nav className="radial-tab-nav">
        <button 
          className={`radial-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <i className="fa-solid fa-chart-pie"></i> Genel Risk & Özet
        </button>

        <button 
          className={`radial-tab-btn ${activeTab === 'aging' ? 'active' : ''}`}
          onClick={() => setActiveTab('aging')}
        >
          <i className="fa-solid fa-chart-simple"></i> Yaşlandırma & Enflasyon Drag
        </button>

        <button 
          className={`radial-tab-btn ${activeTab === 'pareto' ? 'active' : ''}`}
          onClick={() => setActiveTab('pareto')}
        >
          <i className="fa-solid fa-bullseye"></i> Pareto 80/20 Yoğunlaşma
        </button>

        <button 
          className={`radial-tab-btn ${activeTab === 'cei' ? 'active' : ''}`}
          onClick={() => setActiveTab('cei')}
        >
          <i className="fa-solid fa-receipt"></i> CEI & Tahsilat Kanalları
        </button>

        <button 
          className={`radial-tab-btn ${activeTab === 'table' ? 'active' : ''}`}
          onClick={() => setActiveTab('table')}
        >
          <i className="fa-solid fa-list-check"></i> Detaylı Müşteri Tablosu ({filteredCustomerList.length})
        </button>
      </nav>

      {/* 6. Active Tab Panel Content */}
      <div className="ai-risk-panel">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="radial-panel-grid">
            {/* Left: Pareto Top Debtor Risk Feed */}
            <div className="radial-card">
              <div className="card-title-head">
                <span className="card-title-text">
                  <i className="fa-solid fa-bullseye" style={{ color: '#6366F1' }}></i> Pareto 80/20 Alacak Yoğunlaşması
                </span>
                <span className="radial-chip-item purple">{paretoVal} Yoğunluk</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#94A3B8', margin: 0 }}>
                En yüksek bakiyeli %20 cari müşteri grubunun toplam şirket alacağındaki payı.
              </p>

              <div className="risk-feed-list">
                {paretoData.debtPareto.topDebtors.slice(0, 5).map((c: any, i: number) => (
                  <div 
                    key={c.customerId}
                    className="risk-feed-item"
                    onClick={() => triggerOpenCustomerModal(c.original || c)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="risk-avatar-box" style={{
                        background: i < 3 ? 'rgba(244, 63, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: i < 3 ? '#F87171' : '#60A5FA'
                      }}>
                        #{i + 1}
                      </div>
                      <div>
                        <div style={{ color: '#F8FAFC', fontWeight: 700, fontSize: '0.88rem' }}>
                          {cleanName(c.name)}
                        </div>
                        <div style={{ color: '#94A3B8', fontSize: '0.72rem', marginTop: '2px' }}>
                          Vadesi Geçen: <strong style={{ color: (c.overdueBalance || 0) > 0 ? '#F87171' : '#2DD4BF' }}>
                            {formatCurrency(c.overdueBalance || 0)}
                          </strong> • Pay: %{c.share}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#F8FAFC', fontWeight: 700, fontSize: '0.95rem', fontFamily: 'monospace' }}>
                        {formatCurrency(c.value || 0)}
                      </div>
                      <span className={`radial-chip-item ${(c.overdueBalance || 0) > 50000 ? 'rose' : ((c.overdueBalance || 0) > 0 ? 'amber' : 'teal')}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                        {(c.overdueBalance || 0) > 50000 ? 'Kritik Risk' : ((c.overdueBalance || 0) > 0 ? 'Orta Risk' : 'Düşük Risk')}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button 
                        className="risk-act-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickQuestion(`${c.name} firmasının borç durumu ve tahsilat süreci hakkında bilgi verir misin?`);
                        }}
                      >
                        <i className="fa-brands fa-whatsapp"></i> İhtar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Aging & Inflation Exposure Summary */}
            <div className="radial-card">
              <div className="card-title-head">
                <span className="card-title-text">
                  <i className="fa-solid fa-heart-pulse" style={{ color: '#EC4899' }}></i> Kurumsal Sağlık & Yaşlandırma Kırılımı
                </span>
                <span className="radial-chip-item teal">
                  Skor: {healthScore} / 100
                </span>
              </div>

              {/* Bar Chart Visual */}
              <div style={{ width: '100%', height: '180px', marginTop: '6px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agingChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(val) => `₺${(val / 1000000).toFixed(1)}M`} />
                    <Tooltip 
                      formatter={(val: any) => [formatCurrency(Number(val)), 'Tutar']}
                      contentStyle={{ background: 'rgba(14, 20, 36, 0.95)', borderColor: 'rgba(255,255,255,0.15)', borderRadius: '10px', color: '#FFF' }}
                    />
                    <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                      {agingChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Table of Aging Buckets */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {agingChartData.map((item, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.04)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }}></div>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.name}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ color: '#94A3B8', fontSize: '0.78rem' }}>{item.count} Müşteri</span>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: item.color, fontFamily: 'monospace' }}>
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AGING & INFLATION DRAG */}
        {activeTab === 'aging' && (
          <div className="radial-card">
            <div className="card-title-head">
              <span className="card-title-text">
                <i className="fa-solid fa-chart-simple" style={{ color: '#14B8A6' }}></i> Yaşlandırma Dağılımı ve Enflasyon Drag Yükü Analizi
              </span>
              <span className="radial-chip-item amber">Ağırlıklı Vade: {finHealthData.agingDistribution?.averageVade || 0} Gün</span>
            </div>

            <div style={{ width: '100%', height: '260px', marginTop: '10px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingChartData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(val) => `₺${(val / 1000000).toFixed(1)}M`} />
                  <Tooltip 
                    formatter={(val: any) => [formatCurrency(Number(val)), 'Toplam Tutar']}
                    contentStyle={{ background: 'rgba(14, 20, 36, 0.95)', borderColor: 'rgba(255,255,255,0.15)', borderRadius: '10px', color: '#FFF' }}
                  />
                  <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                    {agingChartData.map((entry, index) => (
                      <Cell key={`cell-aging-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="table-responsive" style={{ marginTop: '10px' }}>
              <table className="radial-table">
                <thead>
                  <tr>
                    <th>Vade Dilimi</th>
                    <th>Etki & Risk Seviyesi</th>
                    <th style={{ textAlign: 'right' }}>Müşteri Sayısı</th>
                    <th style={{ textAlign: 'right' }}>Vadesi Geçen Tutar</th>
                    <th style={{ textAlign: 'right' }}>Aylık Enflasyon Maliyet Yükü (%4.5)</th>
                  </tr>
                </thead>
                <tbody>
                  {agingChartData.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{row.name}</td>
                      <td>
                        <span className={`radial-chip-item ${idx === 0 ? 'teal' : idx === 1 ? 'amber' : 'rose'}`}>
                          {idx === 0 ? 'Normal' : idx === 1 ? 'Orta Uyarı' : 'Kritik Risk'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{row.count}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: row.color, fontFamily: 'monospace' }}>
                        {formatCurrency(row.amount)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#F87171', fontFamily: 'monospace' }}>
                        {formatCurrency(row.amount * 0.045)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: PARETO 80/20 */}
        {activeTab === 'pareto' && (
          <div className="radial-card">
            <div className="card-title-head">
              <span className="card-title-text">
                <i className="fa-solid fa-bullseye" style={{ color: '#6366F1' }}></i> Pareto 80/20 Risk Yoğunlaşması Analizi
              </span>
              <span className="radial-chip-item purple">
                En Borçlu %20 Payı: {paretoVal}
              </span>
            </div>

            <p style={{ color: '#E2E8F0', fontSize: '0.88rem', lineHeight: '1.6' }}>
              {paretoData.debtPareto?.summary} Toplam alacak bakiyenizin ezici çoğunluğu az sayıda müşteride toplanmaktadır. 
              Bu gruptaki müşterilerin tahsilat gecikmeleri şirket nakit akışını doğrudan etkilemektedir.
            </p>

            <div className="table-responsive" style={{ marginTop: '10px' }}>
              <table className="radial-table">
                <thead>
                  <tr>
                    <th>Sıra</th>
                    <th>Müşteri Unvanı / Tabela</th>
                    <th>Temsilci</th>
                    <th style={{ textAlign: 'right' }}>Vadesi Geçen Borç</th>
                    <th style={{ textAlign: 'right' }}>Net Alacak Bakiyesi</th>
                    <th style={{ textAlign: 'right' }}>Toplam Alacak Payı</th>
                    <th>Risk Durumu</th>
                  </tr>
                </thead>
                <tbody>
                  {paretoData.debtPareto.topDebtors.map((c: any, i: number) => (
                    <tr key={c.customerId} onClick={() => triggerOpenCustomerModal(c.original || c)}>
                      <td style={{ fontWeight: 700, color: i < 3 ? '#F87171' : '#60A5FA' }}>#{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{cleanName(c.name)}</td>
                      <td style={{ color: '#94A3B8' }}>{c.salesRep || c.salesRepName || 'Bilinmiyor'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: (c.overdueBalance || 0) > 0 ? '#F87171' : '#2DD4BF' }}>
                        {formatCurrency(c.overdueBalance || 0)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{formatCurrency(c.value || 0)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#A5B4FC' }}>%{c.share}</td>
                      <td>
                        <span className={`radial-chip-item ${(c.overdueBalance || 0) > 50000 ? 'rose' : ((c.overdueBalance || 0) > 0 ? 'amber' : 'teal')}`}>
                          {(c.overdueBalance || 0) > 50000 ? 'Kritik Risk' : ((c.overdueBalance || 0) > 0 ? 'Orta Risk' : 'Düşük Risk')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: CEI & COLLECTION CHANNELS */}
        {activeTab === 'cei' && (
          <div className="radial-panel-grid">
            <div className="radial-card">
              <div className="card-title-head">
                <span className="card-title-text">
                  <i className="fa-solid fa-receipt" style={{ color: '#2DD4BF' }}></i> Koleksiyon Etkinlik İndeksi (CEI)
                </span>
                <span className="radial-chip-item teal">
                  CEI: %{ceiVal.toFixed(1)}
                </span>
              </div>

              <p style={{ color: '#E2E8F0', fontSize: '0.88rem', lineHeight: '1.6' }}>
                <strong>Değerlendirme:</strong> {ceiData.evaluation}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                  <span>Toplam Satış Hacmi:</span>
                  <strong style={{ color: '#60A5FA', fontFamily: 'monospace' }}>{formatCurrency(ceiData.totalSalesAmount || globalSummary.totalSales)}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                  <span>Toplam Tahsilat Havuzu (Tahsilat + Dekont):</span>
                  <strong style={{ color: '#2DD4BF', fontFamily: 'monospace' }}>{formatCurrency(ceiData.totalCollectionPoolAmount || globalSummary.totalCollections)}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                  <span>Net Alacak Bakiyesi:</span>
                  <strong style={{ color: '#A5B4FC', fontFamily: 'monospace' }}>{formatCurrency(ceiData.netReceivablesAmount || globalSummary.totalNetReceivables)}</strong>
                </div>
              </div>
            </div>

            {/* Donut Chart */}
            <div className="radial-card">
              <div className="card-title-head">
                <span className="card-title-text">
                  <i className="fa-solid fa-pie-chart" style={{ color: '#EC4899' }}></i> Ödeme & Tahsilat Kanalları Kırılımı
                </span>
              </div>

              {paymentBreakdownData.length > 0 ? (
                <div style={{ width: '100%', height: '220px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={paymentBreakdownData} 
                        dataKey="value" 
                        nameKey="name" 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={55} 
                        outerRadius={85} 
                        paddingAngle={4}
                      >
                        {paymentBreakdownData.map((entry, index) => (
                          <Cell key={`pie-cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(val: any) => [formatCurrency(Number(val)), 'Tutar']}
                        contentStyle={{ background: 'rgba(14, 20, 36, 0.95)', borderColor: 'rgba(255,255,255,0.15)', borderRadius: '8px', color: '#FFF' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8' }}>
                  Ödeme metodu verisi bulunamadı.
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                {paymentBreakdownData.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#E2E8F0', background: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: '6px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }}></div>
                    <span>{item.name}: <strong>{formatCurrency(item.value)}</strong></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: DETAILED CUSTOMERS TABLE */}
        {activeTab === 'table' && (
          <div className="radial-card">
            <div className="card-title-head">
              <span className="card-title-text">
                <i className="fa-solid fa-list-check" style={{ color: '#6366F1' }}></i> Detaylı Müşteri Risk Tablosu ({filteredCustomerList.length} Cari)
              </span>
              <span className="radial-chip-item rose">
                90+ Gün Kritik Borçlu: {overdue90List.totalOverdueCustomersCount}
              </span>
            </div>

            <div className="table-responsive">
              <table className="radial-table">
                <thead>
                  <tr>
                    <th>Müşteri Kodu</th>
                    <th>Unvan / Tabela Adı</th>
                    <th>Temsilci</th>
                    <th style={{ textAlign: 'right' }}>Toplam Net Alacak</th>
                    <th style={{ textAlign: 'right' }}>Vadesi Geçen Borç</th>
                    <th style={{ textAlign: 'right' }}>Max Gecikme (Gün)</th>
                    <th>Risk Seviyesi</th>
                    <th style={{ textAlign: 'center' }}>Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomerList.length > 0 ? (
                    filteredCustomerList.map((c) => (
                      <tr key={c.customerId} onClick={() => triggerOpenCustomerModal(c)}>
                        <td style={{ fontFamily: 'monospace', color: '#94A3B8' }}>{c.customerId}</td>
                        <td style={{ fontWeight: 600 }}>{cleanName(c.customerName || c.signName)}</td>
                        <td style={{ color: '#94A3B8' }}>{c.salesRepName || c.salesRep || 'Bilinmiyor'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{formatCurrency(c.calculatedBalance)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: c.calculatedOverdue > 0 ? '#F87171' : '#2DD4BF' }}>
                          {formatCurrency(c.calculatedOverdue)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: (c.longestOverdueDays || 0) > 90 ? '#F87171' : '#F8FAFC' }}>
                          {c.longestOverdueDays ? `${c.longestOverdueDays} Gün` : '—'}
                        </td>
                        <td>
                          <span className={`radial-chip-item ${c.riskLevel === 'HIGH' ? 'rose' : c.riskLevel === 'MEDIUM' ? 'amber' : 'teal'}`}>
                            {c.riskLevel === 'HIGH' ? 'Kritik Risk' : c.riskLevel === 'MEDIUM' ? 'Orta Risk' : 'Normal'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            className="radial-btn" 
                            style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerOpenCustomerModal(c);
                            }}
                          >
                            <i className="fa-solid fa-eye"></i> Ekstre
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: '#94A3B8' }}>
                        Arama veya filtre kriterlerinize uyan müşteri bulunamadı.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 7. AI Prompt Bar (Quick AI Query Chips) */}
      <div className="radial-prompt-bar">
        <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <i className="fa-solid fa-wand-magic-sparkles" style={{ color: '#6366F1' }}></i>
          Günlü AI CFO Akıllı Soru & Rapor Asistanı
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            className="radial-prompt-chip"
            onClick={() => handleQuickQuestion('Şirket genelinde vadesi 90 günü geçen tüm alacakları listeleyip risk raporu çıkarır mısın?')}
          >
            <i className="fa-solid fa-triangle-exclamation" style={{ color: '#F87171' }}></i>
            90+ Gün Kritik Borçlu Raporu Çıkar
          </button>

          <button 
            className="radial-prompt-chip"
            onClick={() => handleQuickQuestion('En yüksek alacak bakiyesine sahip ilk 10 müşterinin tahsilat risk değerlendirmesini yap.')}
          >
            <i className="fa-solid fa-bullseye" style={{ color: '#6366F1' }}></i>
            Top 10 Borçlu Pareto Değerlendirmesi
          </button>

          <button 
            className="radial-prompt-chip"
            onClick={() => handleQuickQuestion('Tahsilat Etkinlik İndeksi (CEI) oranını artırmak için hangi aksiyonlar önerilir?')}
          >
            <i className="fa-solid fa-circle-check" style={{ color: '#2DD4BF' }}></i>
            CEI Artırma & Tahsilat Aksiyon Planı
          </button>
        </div>
      </div>
    </div>
  );
}
