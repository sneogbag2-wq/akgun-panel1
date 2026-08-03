import React, { useState, useEffect, useMemo } from 'react';
import {
  getShipmentTrackingDataSync,
  searchCustomersSync,
  subscribeDataChange,
  setDashboardActiveFilters,
  setHoverAnalyticsData,
  getMonthlySalesRepPerformanceSync
} from '../services/customerService';
import { formatCurrency, formatDate } from '../utils/formatters';
import CustomerDetailModal from '../components/modals/CustomerDetailModal';
import './FaturaKontrolPage.css'; // Using the same CSS file for styling

function getVadeBadge(c: any) {
  const days = typeof c === 'number' ? c : (typeof c?.averageVade === 'number' ? c.averageVade : 0);

  if (days <= 0) {
    return (
      <span className="vade-pill-badge vade-pill-badge--neutral">
        <i className="fa-solid fa-clock" /> 0 Gün
      </span>
    );
  } else if (days <= 30) {
    return (
      <span className="vade-pill-badge vade-pill-badge--green">
        <i className="fa-solid fa-clock" /> {days} Gün
      </span>
    );
  } else if (days <= 60) {
    return (
      <span className="vade-pill-badge vade-pill-badge--amber">
        <i className="fa-solid fa-clock" /> {days} Gün
      </span>
    );
  } else {
    return (
      <span className="vade-pill-badge vade-pill-badge--red">
        <i className="fa-solid fa-triangle-exclamation" /> {days} Gün
      </span>
    );
  }
}

export default function SevkiyatTakipPage() {
  // Sabit bugün tarihi
  const selectedDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [activeRepFilter, setActiveRepFilter] = useState('');
  const [searchQuery, setSearchQuery]         = useState('');
  const [sortBy, setSortBy]                   = useState('balance');
  const [displayLimit, setDisplayLimit]       = useState(18);

  const [controlData, setControlData]         = useState<any>(() => getShipmentTrackingDataSync(selectedDate));
  const [activeCustomerDetail, setActiveCustomerDetail] = useState<{customer: any, tab: 'INVOICES'|'STATEMENT'|'ANALYSIS'|'CHEQUE'} | null>(null);

  const allCustomers = useMemo(() => searchCustomersSync(), []);

  const availableReps = useMemo(() => {
    const counts: Record<string, number> = {};
    const list = controlData.customers?.length ? controlData.customers : allCustomers;
    list.forEach((c: any) => {
      const rep = c.salesRepName?.trim() || 'Key Account';
      counts[rep] = (counts[rep] || 0) + 1;
    });
    return Object.keys(counts).sort((a, b) => a.localeCompare(b));
  }, [controlData.customers, allCustomers]);

  const grandTotals = useMemo(() => {
    if (!selectedDate || !controlData?.stats) {
      return null;
    }

    let custs: any[] = controlData.customers || [];
    if (activeRepFilter) {
      custs = custs.filter(c => (c.salesRepName?.trim() || 'Key Account') === activeRepFilter);
    }

    const totalInvoices = custs.reduce((sum, c) => sum + (c.invoiceTotal || 0), 0);
    const totalCollections = custs.reduce((sum, c) => sum + (c.collectionTotal || 0), 0);
    const invoiceCount = custs.filter(c => (c.invoiceTotal || 0) > 0).length;
    const collectionCount = custs.filter(c => (c.collectionTotal || 0) > 0).length;

    const openInvoiceTotal = Math.max(0, totalInvoices - totalCollections);
    const coverageRatio = totalInvoices > 0
      ? Math.min(100, Math.round((totalCollections / totalInvoices) * 100))
      : (totalCollections > 0 ? 100 : 0);

    // Top Invoice Customer
    const sortedByInvoice = [...custs].filter(c => (c.invoiceTotal || 0) > 0).sort((a, b) => b.invoiceTotal - a.invoiceTotal);
    const topInvoiceCust = sortedByInvoice[0] || null;

    // Most Risky Invoice Customer
    const sortedByRisk = [...custs]
      .filter(c => (c.invoiceTotal || 0) > 0)
      .sort((a, b) => (b.balance || 0) - (a.balance || 0));
    const mostRiskyCust = sortedByRisk[0] || null;

    // Top Collection Customer
    const sortedByCollection = [...custs].filter(c => (c.collectionTotal || 0) > 0).sort((a, b) => b.collectionTotal - a.collectionTotal);
    const topCollectionCust = sortedByCollection[0] || null;

    // Same Day Closed Customers Count
    const sameDayClosedCount = custs.filter(c => (c.invoiceTotal || 0) > 0 && (c.collectionTotal || 0) >= (c.invoiceTotal || 0)).length;

    // Top 3 Open Invoice Debtors
    const openInvoiceCusts = custs
      .map(c => ({
        ...c,
        openAmt: Math.max(0, (c.invoiceTotal || 0) - (c.collectionTotal || 0))
      }))
      .filter(c => c.openAmt > 0)
      .sort((a, b) => b.openAmt - a.openAmt);

    const top3OpenCusts = openInvoiceCusts.slice(0, 3);

    let aiTone: 'healthy' | 'warning' | 'danger' = 'healthy';
    let aiBadge = '🟢 Yüksek Tahsilat Performansı';
    let aiSummary = '';
    let aiAdvice = '';

    const formattedDate = formatDate(selectedDate);
    const top3NamesStr = top3OpenCusts.map(c => `${c.signName || c.customerName} (${formatCurrency(c.openAmt)})`).join(', ');

    // Plasiyer Bazlı Üst Düzey Raporlama (Eğer plasiyer seçiliyse)
    let repMetricsText = '';
    let repNameStr = 'Şirket Geneli';
    let repData: any = null;
    if (activeRepFilter) {
      repNameStr = activeRepFilter;
      const repPerf = getMonthlySalesRepPerformanceSync();
      repData = repPerf.repList.find(r => r.repName === activeRepFilter) || null;
      if (repData) {
        repMetricsText = ` Plasiyer portföyünde toplam ${repData.customerCount} cari ve ${formatCurrency(repData.totalNetReceivables)} açık bakiye yükü bulunmaktadır.`;
      }
    }

    if (totalInvoices === 0 && totalCollections === 0) {
      aiBadge = 'ℹ️ İşlem Yok';
      aiSummary = `${repNameStr} için ${formattedDate} tarihinde kaydedilmiş sipariş veya tahsilat hareketi bulunmamaktadır.`;
      aiAdvice = 'Arşive yeni sevkiyat dosyası yüklenmesi bekleniyor.';
    } else if (coverageRatio >= 80) {
      aiTone = 'healthy';
      aiBadge = `🟢 Yüksek Tahsilat Performansı (%${coverageRatio} Karşılama)`;
      aiSummary = `${repNameStr} için ${formattedDate} tarihinde alınan ${formatCurrency(totalInvoices)} siparişin %${coverageRatio}'si (${formatCurrency(totalCollections)}) aynı gün tahsil edildi.`;
      aiAdvice = `Nakit akışı çok sağlıklıdır.${repMetricsText} Açık sipariş riski yalnızca ${formatCurrency(openInvoiceTotal)} seviyesindedir.`;
    } else if (coverageRatio >= 40) {
      aiTone = 'warning';
      aiBadge = `🟡 Dengeli Tahsilat & Kısmi Açık Bakiye (%${coverageRatio} Karşılama)`;
      aiSummary = `${repNameStr} portföyünde ${formattedDate} tarihinde alınan ${formatCurrency(totalInvoices)} siparişlere karşılık ${formatCurrency(totalCollections)} tahsilat alındı (%${coverageRatio} karşılama).`;
      aiAdvice = `${repMetricsText} ${formatCurrency(openInvoiceTotal)} açık sipariş tutarı mevcuttur. En yüksek açık borçlular: ${top3NamesStr || 'Yok'}. Plasiyer takibi önerilir.`;
    } else {
      aiTone = 'danger';
      aiBadge = `🔴 Yüksek Açık Sipariş Riski (%${coverageRatio} Karşılama)`;
      aiSummary = `${repNameStr} portföyünde ${formattedDate} tarihinde ${formatCurrency(totalInvoices)} sipariş alınmasına rağmen tahsilat ${formatCurrency(totalCollections)} seviyesinde kalmıştır (%${coverageRatio} karşılama).`;
      aiAdvice = `⚠️ Dikkat!${repMetricsText} Günlük sevkiyatlarda ${formatCurrency(openInvoiceTotal)} açık bakiye oluştu! En yüksek açık borçlular: ${top3NamesStr || 'Yok'}. ${activeRepFilter ? 'Saha yöneticisine' : 'Plasiyerlere'} acil POS/tahsilat hedefi verilmelidir.`;
    }

    const card1Metrics = [
      {
        label: 'En Yüksek Sipariş',
        value: topInvoiceCust ? `${topInvoiceCust.signName || topInvoiceCust.customerName} (${formatCurrency(topInvoiceCust.invoiceTotal)})` : 'Sipariş Yok',
        color: '#10B981'
      },
      {
        label: 'En Riskli Cari',
        value: mostRiskyCust ? `${mostRiskyCust.signName || mostRiskyCust.customerName} (${formatCurrency(mostRiskyCust.balance)} Borç • ${mostRiskyCust.averageVade || 0}G Vade)` : 'Risk Yok',
        color: '#EF4444'
      },
      {
        label: 'Ortalama Sipariş',
        value: invoiceCount > 0 ? formatCurrency(Math.round(totalInvoices / invoiceCount)) : '—',
        color: '#3B82F6'
      }
    ];

    const card2Metrics = [
      {
        label: 'En Yüksek Tahsilat',
        value: topCollectionCust ? `${topCollectionCust.signName || topCollectionCust.customerName} (${formatCurrency(topCollectionCust.collectionTotal)})` : 'Tahsilat Yok',
        color: '#2563EB'
      },
      {
        label: 'Tam Ödeyen Cariler',
        value: `${sameDayClosedCount} Müşteri Siparişini Kapattı`,
        color: '#10B981'
      },
      {
        label: 'Toplam Emanet / Litre',
        value: `${formatCurrency(controlData.stats.totalEmanet || 0)} / ${(controlData.stats.totalLiters || 0).toLocaleString()} Lt`,
        color: '#F59E0B'
      }
    ];

    const card3Metrics = top3OpenCusts.length > 0
      ? top3OpenCusts.map((c, idx) => ({
          label: `${idx + 1}. En Yüksek Açık Borç`,
          value: `${c.signName || c.customerName} (${formatCurrency(c.openAmt)}${c.averageVade > 0 ? ` • ${c.averageVade}G Vade` : ''})`,
          color: '#DC2626'
        }))
      : [
          {
            label: 'Açık Sipariş Durumu',
            value: 'Tüm siparişler kapatıldı, açık bakiye yok',
            color: '#10B981'
          }
        ];

    const averageOrderVade = controlData.stats.averageOrderVade || 0;
    const orderCustomerCount = controlData.stats.orderCustomerCount || 0;

    return {
      totalInvoices,
      totalCollections,
      totalPrevCollections: 0,
      openInvoiceTotal,
      coverageRatio,
      invoiceCount,
      collectionCount,
      averageOrderVade,
      orderCustomerCount,
      formattedDate,
      topInvoiceCust,
      mostRiskyCust,
      topCollectionCust,
      top3OpenCusts,
      card1Metrics,
      card2Metrics,
      card3Metrics,
      aiTone,
      aiBadge,
      aiSummary,
      aiAdvice,
      repData,
      repNameStr
    };
  }, [selectedDate, controlData, activeRepFilter]);

  const reloadData = () => {
    setControlData(getShipmentTrackingDataSync(selectedDate));
  };

  useEffect(() => {
    setControlData(getShipmentTrackingDataSync(selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    setDashboardActiveFilters({
      page: 'sevkiyat-takip',
      selectedDate,
      repFilter: activeRepFilter || 'ALL',
      searchQuery
    });
  }, [selectedDate, activeRepFilter, searchQuery]);

  useEffect(() => {
    return () => {
      setDashboardActiveFilters({ page: 'dashboard', selectedDate: '', repFilter: 'ALL', searchQuery: '' });
    };
  }, []);

  useEffect(() => {
    setDisplayLimit(18);
  }, [selectedDate, activeRepFilter, searchQuery, sortBy]);

  useEffect(() => {
    const unsub = subscribeDataChange(reloadData);
    return () => unsub();
  }, [selectedDate]);

  const displayedCustomers = useMemo(() => {
    let list: any[] = controlData.customers || [];
    const q = searchQuery.trim().toLowerCase();

    if (activeRepFilter) {
      list = list.filter(c => (c.salesRepName?.trim() || 'Key Account') === activeRepFilter);
    }

    if (q) {
      list = list.filter(c => {
        const searchStr = (c.customerName || '') + ' ' + (c.signName || '') + ' ' + (c.customerId || '');
        return searchStr.toLowerCase().includes(q);
      });
    }

    return [...list].sort((a, b) => {
      if (sortBy === 'invoice') {
        return (b.invoiceTotal || 0) - (a.invoiceTotal || 0); // invoiceTotal represents orders
      } else if (sortBy === 'name') {
        return (a.signName || a.customerName || '').localeCompare(b.signName || b.customerName || '');
      }
      return (b.balance || 0) - (a.balance || 0);
    });
  }, [controlData.customers, activeRepFilter, searchQuery, sortBy]);

  return (
    <div className="fatura-kontrol-page animate-fadeIn">
      {selectedDate && grandTotals && (
        <div className="fk-grand-totals-bar animate-fadeIn" style={{ marginTop: 0 }}>
          <div className="fk-gt-header">
            <div className="fk-gt-title">
              <span><i className="fa-solid fa-truck-fast" style={{ color: '#8A6D1F' }} /></span> Sevkiyat & Yükleme Takip
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div className="fk-gt-date-tag" style={{ background: 'rgba(139, 92, 246, 0.15)', borderColor: 'rgba(139, 92, 246, 0.3)', color: '#C084FC' }}>
                <i className="fa-solid fa-clock" /> Ort. Vade: {grandTotals.averageOrderVade} Gün ({grandTotals.orderCustomerCount} Müşteri)
              </div>
              <div className="fk-gt-date-tag">
                <i className="fa-solid fa-calendar-check" /> {grandTotals.formattedDate}
              </div>
            </div>
          </div>

          <div className="fk-gt-grid">
            <div
              className="fk-gt-card fk-gt-card--invoice"
              onMouseEnter={(e) => setHoverAnalyticsData({
                type: 'KPI',
                title: `Alınan Toplam Sipariş (${grandTotals.formattedDate})`,
                subtitle: `${grandTotals.invoiceCount} adet sipariş işlendi`,
                metrics: grandTotals.card1Metrics,
                advice: grandTotals.topInvoiceCust
                  ? `Seçilen tarihte en yüksek sipariş ${grandTotals.topInvoiceCust.signName || grandTotals.topInvoiceCust.customerName} cari hesabına (${formatCurrency(grandTotals.topInvoiceCust.invoiceTotal)}) aittir.`
                  : grandTotals.aiAdvice,
                page: 'sevkiyat-takip',
                selectedDate,
                targetRect: e.currentTarget.getBoundingClientRect()
              })}
              onMouseLeave={() => setHoverAnalyticsData(null)}
            >
              <div className="fk-gt-card__top">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="fk-gt-card__icon"><i className="fa-solid fa-file-invoice-dollar" style={{ color: '#34D399' }} /></span>
                  <span className="fk-gt-card__lbl">ALINAN TOPLAM SİPARİŞ</span>
                </div>
                <span className="kpi-mini-badge kpi-mini-badge--blue">📦 {grandTotals.invoiceCount} Adet</span>
              </div>
              
              <div className="fk-gt-card__val num" style={{ color: '#34D399' }}>
                {formatCurrency(grandTotals.totalInvoices)}
              </div>

              <div className="kpi-card-micro-grid">
                <div className="kpi-micro-item">
                  <span className="kpi-micro-lbl">ORT. VADE</span>
                  <span className="kpi-micro-val">{grandTotals.averageOrderVade} Gün</span>
                </div>
                <div className="kpi-micro-divider"></div>
                <div className="kpi-micro-item">
                  <span className="kpi-micro-lbl">AKTİF MÜŞTERİ</span>
                  <span className="kpi-micro-val">{grandTotals.orderCustomerCount} Cari</span>
                </div>
              </div>
            </div>

            <div
              className="fk-gt-card fk-gt-card--collection"
              onMouseEnter={(e) => setHoverAnalyticsData({
                type: 'KPI',
                title: `Alınan Toplam Tahsilat (${grandTotals.formattedDate})`,
                subtitle: `${grandTotals.collectionCount} adet tahsilat kaydı işlendi`,
                metrics: grandTotals.card2Metrics,
                advice: grandTotals.topCollectionCust
                  ? `Günün en yüksek tahsilatı ${grandTotals.topCollectionCust.signName || grandTotals.topCollectionCust.customerName} müşterisinden (${formatCurrency(grandTotals.topCollectionCust.collectionTotal)}) alınmıştır.`
                  : `Seçilen tarihte alınan tahsilatlar sipariş tutarının %${grandTotals.coverageRatio}'sini karşılamaktadır.`,
                page: 'sevkiyat-takip',
                selectedDate,
                targetRect: e.currentTarget.getBoundingClientRect()
              })}
              onMouseLeave={() => setHoverAnalyticsData(null)}
            >
              <div className="fk-gt-card__top">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="fk-gt-card__icon"><i className="fa-solid fa-hand-holding-dollar" style={{ color: '#60A5FA' }} /></span>
                  <span className="fk-gt-card__lbl">ALINAN TOPLAM TAHSİLAT</span>
                </div>
                <span className="kpi-mini-badge kpi-mini-badge--green">⚡ %{grandTotals.coverageRatio} Karşılama</span>
              </div>

              <div className="fk-gt-card__val num" style={{ color: '#60A5FA' }}>
                {formatCurrency(grandTotals.totalCollections)}
              </div>

              <div className="kpi-progress-wrap">
                <div className="kpi-progress-bar" style={{ width: `${Math.min(100, grandTotals.coverageRatio)}%` }}></div>
              </div>

              <div className="kpi-card-micro-grid">
                <div className="kpi-micro-item">
                  <span className="kpi-micro-lbl">TAHSİLAT KAYDI</span>
                  <span className="kpi-micro-val">{grandTotals.collectionCount} Kayıt</span>
                </div>
                <div className="kpi-micro-divider"></div>
                <div className="kpi-micro-item">
                  <span className="kpi-micro-lbl">KARŞILAMA ORANI</span>
                  <span className="kpi-micro-val" style={{ color: '#34D399' }}>%{grandTotals.coverageRatio}</span>
                </div>
              </div>
            </div>

            <div
              className={`fk-gt-card fk-gt-card--open ${grandTotals.openInvoiceTotal > 0 ? 'fk-gt-card--open-risk' : 'fk-gt-card--open-clear'}`}
              onMouseEnter={(e) => setHoverAnalyticsData({
                type: 'KPI',
                title: `Kalan Açık Sipariş Tutarı (${grandTotals.formattedDate})`,
                subtitle: `Tahsilat Karşılama Oranı: %${grandTotals.coverageRatio}`,
                metrics: grandTotals.card3Metrics,
                advice: grandTotals.top3OpenCusts.length > 0
                  ? `Tarihteki en yüksek açık siparişi olan müşteri ${grandTotals.top3OpenCusts[0].signName || grandTotals.top3OpenCusts[0].customerName} (${formatCurrency(grandTotals.top3OpenCusts[0].openAmt)}) hesabıdır. Saha plasiyer takibi önerilir.`
                  : grandTotals.aiAdvice,
                page: 'sevkiyat-takip',
                selectedDate,
                targetRect: e.currentTarget.getBoundingClientRect()
              })}
              onMouseLeave={() => setHoverAnalyticsData(null)}
            >
              <div className="fk-gt-card__top">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="fk-gt-card__icon">
                    {grandTotals.openInvoiceTotal > 0 ? <i className="fa-solid fa-triangle-exclamation" style={{ color: '#F87171' }} /> : <i className="fa-solid fa-circle-check" style={{ color: '#34D399' }} />}
                  </span>
                  <span className="fk-gt-card__lbl">KALAN AÇIK SİPARİŞ TUTARI</span>
                </div>
                <span className={`kpi-mini-badge ${grandTotals.openInvoiceTotal > 0 ? 'kpi-mini-badge--red' : 'kpi-mini-badge--green'}`}>
                  {grandTotals.openInvoiceTotal > 0 ? '⚠️ Açık Bakiye Var' : '✓ Tamamı Kapalı'}
                </span>
              </div>

              <div className="fk-gt-card__val num" style={{ color: grandTotals.openInvoiceTotal > 0 ? '#F87171' : '#34D399' }}>
                {formatCurrency(grandTotals.openInvoiceTotal)}
              </div>

              <div className="kpi-card-micro-grid">
                <div className="kpi-micro-item">
                  <span className="kpi-micro-lbl">EN YÜKSEK AÇIK BORÇ</span>
                  <span className="kpi-micro-val" style={{ color: '#F87171' }}>
                    {grandTotals.top3OpenCusts[0] ? (grandTotals.top3OpenCusts[0].signName || grandTotals.top3OpenCusts[0].customerName).slice(0, 15) : 'Bakiye Yok'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className={`fk-gt-ai-box fk-gt-ai-box--${grandTotals.aiTone}`}>
            <div className="fk-gt-ai-header">
              {grandTotals.repData ? (
                <div className="fk-gt-ai-rep-title">
                  <div className="fk-gt-ai-rep-avatar">
                    <i className="fa-solid fa-user-tie"></i>
                  </div>
                  <div>
                    <span className="fk-gt-ai-rep-name">{grandTotals.repNameStr}</span>
                    <span className="fk-gt-ai-rep-sub">Saha Yönetimi Performans Raporu</span>
                  </div>
                </div>
              ) : (
                <div className="fk-gt-ai-badge">
                  <span className="fk-gt-ai-pulse" />
                  <span>✨ Günlü (AI) Sipariş Yorumu</span>
                </div>
              )}
              <div className="fk-gt-ai-tag">
                {grandTotals.aiBadge}
              </div>
            </div>
            
            <div className="fk-gt-ai-body">
              <p className="fk-gt-ai-summary">{grandTotals.aiSummary}</p>
              <p className="fk-gt-ai-advice">💡 <strong>CFO Aksiyon Tavsiyesi:</strong> {grandTotals.aiAdvice}</p>
              
              {grandTotals.repData && (
                <div 
                  className="fk-gt-ai-rep-metrics-inline"
                  onMouseEnter={(e) => setHoverAnalyticsData({
                    type: 'REP',
                    title: `${grandTotals.repNameStr} - CFO Saha Analizi`,
                    subtitle: `Aylık Tahsilat Performansı: %${grandTotals.repData.collectionPerformance}`,
                    metrics: [
                      { label: 'Aylık Fatura', value: formatCurrency(grandTotals.repData.monthSales), color: '#3B82F6' },
                      { label: 'Aylık Tahsilat', value: formatCurrency(grandTotals.repData.monthCollections), color: '#10B981' }
                    ],
                    advice: `Temsilcinin portföyündeki ${formatCurrency(grandTotals.repData.totalNetReceivables)} bakiyenin ${formatCurrency(grandTotals.repData.totalOverdue28)} kadarı 28 gün ve üzeri yüksek riskli (vadesi geçmiş) noktalar üzerindedir. Ortalama vade ${grandTotals.repData.averageVade} gün olarak ölçülmüştür. ${grandTotals.repData.collectionPerformance < 50 ? 'Tahsilat hızı satış hızının gerisinde kalmış olup, yaşlandırmada artış riski çizmektedir.' : 'Tahsilat performansı dengeli seviyede ilerlemektedir, yaşlandırma kontrol altındadır.'}`,
                    page: 'sevkiyat-takip',
                    selectedDate,
                    targetRect: e.currentTarget.getBoundingClientRect()
                  })}
                  onMouseLeave={() => setHoverAnalyticsData(null)}
                >
                  <div className="fk-rm-item">
                    <span className="fk-rm-lbl">PORTFÖY BÜYÜKLÜĞÜ:</span>
                    <span className="fk-rm-val">{grandTotals.repData.customerCount} Cari</span>
                  </div>
                  <div className="fk-rm-divider"></div>
                  <div className="fk-rm-item">
                    <span className="fk-rm-lbl">RİSKLİ CARİ:</span>
                    <span className="fk-rm-val" style={{ color: grandTotals.repData.riskyCustomerCount > 0 ? '#F87171' : '#34D399' }}>{grandTotals.repData.riskyCustomerCount} Cari</span>
                  </div>
                  <div className="fk-rm-divider"></div>
                  <div className="fk-rm-item">
                    <span className="fk-rm-lbl">BAKİYE YÜKÜ:</span>
                    <span className="fk-rm-val" style={{ color: '#60A5FA' }}>{formatCurrency(grandTotals.repData.totalNetReceivables)}</span>
                  </div>
                  <div className="fk-rm-divider"></div>
                  <div className="fk-rm-item">
                    <span className="fk-rm-lbl">28+ GÜN VADESİ GEÇMİŞ:</span>
                    <span className="fk-rm-val" style={{ color: grandTotals.repData.totalOverdue28 > 0 ? '#F87171' : '#34D399' }}>{formatCurrency(grandTotals.repData.totalOverdue28)}</span>
                  </div>
                  <div className="fk-rm-divider"></div>
                  <div className="fk-rm-item">
                    <span className="fk-rm-lbl">ORT. VADE & TAHSİLAT:</span>
                    <span className="fk-rm-val">{grandTotals.repData.averageVade}G • %{grandTotals.repData.collectionPerformance}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sıkılaştırılmış daraltılmış filtre alanı (AI yorumu altı) */}
      <div className="fk-ch-filters" style={{ margin: '6px 0 10px 0', padding: '6px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="fk-search-wrap">
          <input
            type="text"
            placeholder="Müşteri adı veya kodu ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="fk-search-input"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="fk-search-clear">
              ✕
            </button>
          )}
        </div>

        {availableReps.length > 0 && (
          <select
            value={activeRepFilter}
            onChange={(e) => setActiveRepFilter(e.target.value)}
            className="fk-select-chip"
          >
            <option value="">👤 Tüm Temsilciler</option>
            {availableReps.map(rep => (
              <option key={rep} value={rep}>{rep}</option>
            ))}
          </select>
        )}

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="fk-select-chip"
        >
          <option value="balance">Sırala: Kalan Borç</option>
          <option value="invoice">Sırala: Sipariş Tutarı</option>
          <option value="name">Sırala: Müşteri Adı</option>
        </select>
      </div>

      {displayedCustomers.length === 0 ? (
        <div className="fk-empty-card animate-scaleIn">
          <div className="fk-empty-icon">🔍</div>
          <div>Kriterlere uyan sipariş veya tahsilat kaydı bulunamadı.</div>
        </div>
      ) : (
        <>
          <div className="customer-grid animate-scaleIn">
            {displayedCustomers.slice(0, displayLimit).map((c) => {
              const custName = c.signName || c.customerName || 'Müşteri';
              const repName = c.salesRepName || c.salesRep || 'Key Account';

              return (
                <div 
                  key={c.customerId} 
                  className="cust-card"
                  onMouseEnter={(e) => setHoverAnalyticsData({ type: 'CUSTOMER', title: custName, customerObj: c, page: 'sevkiyat-takip', selectedDate, targetRect: e.currentTarget.getBoundingClientRect() } as any)}
                  onMouseLeave={() => setHoverAnalyticsData(null)}
                >
                  <div className="cust-card__top">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="cust-card__name" title={custName}>
                        {custName}
                      </div>
                      <div className="cust-card__sub" title={`${c.customerId} • ${repName}`}>
                        {c.customerId} • {repName}
                      </div>
                    </div>
                    {getVadeBadge(c)}
                  </div>
                  
                  <div className="cust-card__balance num">
                    {formatCurrency(c.balance)}
                  </div>

                  <div className="fk-stats-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    <div className="fk-stat-col">
                      <span className="fk-stat-lbl">SİPARİŞ</span>
                      <span className={`fk-stat-val num ${c.invoiceTotal > 0 ? 'fk-stat-val--invoice' : ''}`}>
                        {c.invoiceTotal > 0 ? formatCurrency(c.invoiceTotal) : '—'}
                      </span>
                    </div>

                    <div className="fk-stat-col">
                      <span className="fk-stat-lbl">EMANET SP</span>
                      <span className={`fk-stat-val num ${(c.emanetTotal || 0) > 0 ? 'fk-stat-val--amber' : ''}`} style={{ color: (c.emanetTotal || 0) > 0 ? '#F59E0B' : undefined }}>
                        {(c.emanetTotal || 0) > 0 ? formatCurrency(c.emanetTotal) : '—'}
                      </span>
                    </div>

                    <div className="fk-stat-col">
                      <span className="fk-stat-lbl">TAHSİLAT</span>
                      <span className={`fk-stat-val num ${c.collectionTotal > 0 ? 'fk-stat-val--collection' : ''}`}>
                        {c.collectionTotal > 0 ? formatCurrency(c.collectionTotal) : '—'}
                      </span>
                    </div>
                    
                    <div className="fk-stat-col">
                      <span className="fk-stat-lbl">LİTRE</span>
                      <span className="fk-stat-val num" style={{ color: c.litersTotal > 0 ? '#A78BFA' : undefined }}>
                        {c.litersTotal > 0 ? `${c.litersTotal.toLocaleString()} Lt` : '—'}
                      </span>
                    </div>
                  </div>

                  {c.cekSenet > 0 && (
                    <div className="cust-card__cek-risk">
                      <span className="cust-card__cek-dot"></span>
                      <span>Çek/Senet:</span>
                      <span className="num">{formatCurrency(c.cekSenet)}</span>
                    </div>
                  )}

                  {c.isRisky && (
                    <div style={{ marginTop: '8px', color: '#F87171', fontSize: '0.75rem', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {c.riskReasons?.map((r: string, idx: number) => (
                        <span key={idx} style={{ background: 'rgba(248,113,113,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(248,113,113,0.2)' }}>⚠️ {r}</span>
                      ))}
                    </div>
                  )}

                  <div className="cust-card__meta">
                    <span style={{ color: 'var(--text-muted)' }}>
                      {c.province || 'Bölge Yok'} {c.district ? `/ ${c.district}` : ''}
                    </span>
                    <button
                      className="btn-cust-detay"
                      onClick={() => setActiveCustomerDetail({ customer: c, tab: 'STATEMENT' })}
                    >
                      Detay ↗
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {displayedCustomers.length > displayLimit && (
            <div style={{ textAlign: 'center', margin: '24px 0 10px' }}>
              <button
                onClick={() => setDisplayLimit(prev => prev + 18)}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  padding: '10px 24px',
                  borderRadius: '99px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all var(--transition)',
                  boxShadow: 'var(--shadow-xs)'
                }}
              >
                Daha Fazla Göster ({displayedCustomers.length - displayLimit} kart kaldı)
              </button>
            </div>
          )}
        </>
      )}

      <div className="fk-footer-note">
        Bu rapor yüklü ham veri dosyalarından tarayıcınızda anlık olarak hesaplanmıştır. Hiçbir veri sunucuya gönderilmez.
      </div>

      {activeCustomerDetail && (
        <CustomerDetailModal
          customer={activeCustomerDetail.customer}
          initialTab={activeCustomerDetail.tab}
          onClose={() => setActiveCustomerDetail(null)}
        />
      )}
    </div>
  );
}
