import React, { useState, useEffect, useMemo } from 'react';
import { 
  getGlobalFinancialSummarySync,
  getParetoConcentrationAnalysisSync,
  getCollectionEffectivenessIndexSync,
  getFinancialHealthReportSync,
  getAllCustomersForReportingSync,
  getCurrentMonthMetricsSync,
  subscribeDataChange,
  triggerOpenCustomerModal
} from '../services/customerService';
import { formatCurrency } from '../utils/formatters';
import { MascotAvatar } from '../components/ai/MascotAvatar';
import { useAiChat } from '../hooks/useAiChat';
import './AiAnalyticsHubPage.css'; // Reuse CSS for now

export default function AiRiskAnalysisPage() {
  const [dataVersion, setDataVersion] = useState(0);
  const { sendMessage } = useAiChat();

  useEffect(() => {
    return subscribeDataChange(() => {
      setDataVersion(prev => prev + 1);
    });
  }, []);

  const customers = useMemo(() => getAllCustomersForReportingSync(), [dataVersion]);
  const globalSummary = useMemo(() => getGlobalFinancialSummarySync(), [dataVersion]);
  const paretoData = useMemo(() => getParetoConcentrationAnalysisSync(), [dataVersion]);
  const ceiData = useMemo(() => getCollectionEffectivenessIndexSync(''), [dataVersion]);
  const finHealthData = useMemo(() => getFinancialHealthReportSync(''), [dataVersion]);
  const currentMonthMetrics = useMemo(() => getCurrentMonthMetricsSync(), [dataVersion]);

  // Kapsama Süresi (Ay) = Net Alacak / AYLIK Ortalama Tahsilat.
  // NOT: Önceden payda globalSummary.totalCollections idi — bu, sistemde arşivlenmiş
  // TÜM ZAMANLARIN toplam tahsilatıdır, aylık değil. "Ay" birimiyle gösterilen bir
  // sonucu tüm-zamanlar tahsilatına bölmek anlamsızdır; sonuç yüklü veri aralığına
  // (2 ay mı 12 ay mı) göre keyfi şekilde değişir. Doğrusu güncel ayın tahsilat
  // tutarını kullanmaktır (klasik DSO/kapsama süresi mantığı).
  const coverageMonths = useMemo(() => {
    const monthlyCollections = currentMonthMetrics.monthCollections || 0;
    if (monthlyCollections <= 0) return null; // Bölünemez durum — "Hesaplanamıyor" gösterilecek
    return (globalSummary.totalNetReceivables || 0) / monthlyCollections;
  }, [globalSummary, currentMonthMetrics]);

  const totalOverdue = finHealthData.agingDistribution
    ? (finHealthData.agingDistribution.days30 || 0) + (finHealthData.agingDistribution.days60 || 0) + (finHealthData.agingDistribution.days90Plus || 0)
    : 0;
  // NOT: `||` kullanılırsa gerçek CEI=0 (en kötü senaryo: hiç tahsilat yok) durumu da
  // "veri yok" sanılıp sahte bir "iyi" değerle (84.5) maskelenirdi. `??` yalnızca
  // null/undefined durumunda devreye girer, gerçek 0 değerini korur.
  const ceiVal = ceiData.rawCEI ?? 0;
  const paretoVal = paretoData.debtPareto?.customerRatioPercentage ?? "0";


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

  return (
    <div className="ai-hub-container">
      <div className="ai-hub-header">
        <div className="ai-hub-title-group">
          <div className="ai-hub-mascot-box">
            <MascotAvatar size="small" />
          </div>
          <div className="ai-hub-title-text">
            <h1>
              Günlü AI Finansal Sağlık & Risk Analizi
              <span className="ai-hub-badge">
                <i className="fa-solid fa-circle" style={{ fontSize: '8px' }}></i> CFO AI Aktif
              </span>
            </h1>
            <div className="ai-hub-subtitle">Şirket Geneli Risk Durumu ve KPI'lar</div>
          </div>
        </div>
      </div>

      <div className="cfo-hud-banner">
        <div className="cfo-hud-top">
          <div className="cfo-hud-label">
            <i className="fa-solid fa-brain"></i> Günlü Akıllı CFO Değerlendirmesi
          </div>
          <span className="cfo-hud-target-badge">Genel Bakış</span>
        </div>
        <p className="cfo-hud-text">
          Şirket genelinde toplam <strong>{formatCurrency(globalSummary.totalNetReceivables)}</strong> net alacak bulunmakta. Vadesi geçen borç toplamı <strong>{formatCurrency(totalOverdue)}</strong>, Koleksiyon Etkinlik İndeksi (CEI) <strong>%{ceiVal.toFixed(1)}</strong> seviyesindedir. Enflasyonel maliyet drag riski ve vadesi geçen alacaklar yakından takip edilmektedir.
        </p>
        <div className="cfo-hud-highlights">
          <div className="cfo-highlight-chip gold">
            <i className="fa-solid fa-chart-line"></i><span>Net Alacak: {formatCurrency(globalSummary.totalNetReceivables)}</span>
          </div>
          <div className="cfo-highlight-chip warning">
            <i className="fa-solid fa-triangle-exclamation"></i><span>Vadesi Geçen: {formatCurrency(totalOverdue)}</span>
          </div>
          <div className="cfo-highlight-chip success">
            <i className="fa-solid fa-circle-check"></i><span>CEI İndeksi: %{ceiVal.toFixed(1)}</span>
          </div>
          <div className="cfo-highlight-chip purple">
            <i className="fa-solid fa-chart-line"></i><span>Pareto Yoğunluğu: %{paretoVal}</span>
          </div>
        </div>
      </div>

      <div className="ai-hub-kpi-strip" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
        <div className="ai-kpi-card" style={{ background: 'rgba(18,23,38,0.95)', border: '1px solid rgba(59,130,246,0.15)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-15px', right: '-15px', width: '80px', height: '80px', background: 'rgba(59,130,246,0.1)', filter: 'blur(30px)', borderRadius: '50%' }}></div>
          <div className="ai-kpi-header" style={{ position: 'relative', zIndex: 2 }}>
            <span>Toplam Satış Ciro</span>
            <div className="ai-kpi-icon" style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6', boxShadow: '0 0 10px rgba(59,130,246,0.2)' }}><i className="fa-solid fa-file-invoice-dollar"></i></div>
          </div>
          <div className="ai-kpi-value" style={{ position: 'relative', zIndex: 2, fontSize: '1.4rem' }}>{formatCurrency(globalSummary.totalSales)}</div>
          <div className="ai-kpi-sub" style={{ position: 'relative', zIndex: 2 }}>Fatura Hareketleri Toplamı</div>
        </div>

        <div className="ai-kpi-card" style={{ background: 'rgba(18,23,38,0.95)', border: '1px solid rgba(139,92,246,0.15)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-15px', right: '-15px', width: '80px', height: '80px', background: 'rgba(139,92,246,0.1)', filter: 'blur(30px)', borderRadius: '50%' }}></div>
          <div className="ai-kpi-header" style={{ position: 'relative', zIndex: 2 }}>
            <span>Net Alacak Bakiyesi</span>
            <div className="ai-kpi-icon" style={{ background: 'rgba(139,92,246,0.15)', color: '#A78BFA', boxShadow: '0 0 10px rgba(139,92,246,0.2)' }}><i className="fa-solid fa-wallet"></i></div>
          </div>
          <div className="ai-kpi-value" style={{ position: 'relative', zIndex: 2, fontSize: '1.4rem' }}>{formatCurrency(globalSummary.totalNetReceivables)}</div>
          <div className="ai-kpi-sub" style={{ position: 'relative', zIndex: 2 }}>Toplanacak Cari Bakiye</div>
        </div>

        <div className="ai-kpi-card" style={{ background: 'rgba(18,23,38,0.95)', border: '1px solid rgba(251,123,133,0.15)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-15px', right: '-15px', width: '80px', height: '80px', background: 'rgba(251,123,133,0.1)', filter: 'blur(30px)', borderRadius: '50%' }}></div>
          <div className="ai-kpi-header" style={{ position: 'relative', zIndex: 2 }}>
            <span style={{ color: '#FB7B85' }}>Vadesi Geçen Riski</span>
            <div className="ai-kpi-icon" style={{ background: 'rgba(251,123,133,0.15)', color: '#FB7B85', boxShadow: '0 0 10px rgba(251,123,133,0.2)' }}><i className="fa-solid fa-circle-exclamation"></i></div>
          </div>
          <div className="ai-kpi-value" style={{ position: 'relative', zIndex: 2, color: '#FB7B85', fontSize: '1.4rem' }}>{formatCurrency(totalOverdue)}</div>
          <div className="ai-kpi-sub" style={{ position: 'relative', zIndex: 2 }}>Vadesi Dolan Borçlar</div>
        </div>

        <div className="ai-kpi-card" style={{ background: 'rgba(18,23,38,0.95)', border: '1px solid rgba(61,220,154,0.15)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-15px', right: '-15px', width: '80px', height: '80px', background: 'rgba(61,220,154,0.1)', filter: 'blur(30px)', borderRadius: '50%' }}></div>
          <div className="ai-kpi-header" style={{ position: 'relative', zIndex: 2 }}>
            <span>CEI Tahsilat İndeksi</span>
            <div className="ai-kpi-icon" style={{ background: 'rgba(61,220,154,0.15)', color: '#3DDC9A', boxShadow: '0 0 10px rgba(61,220,154,0.2)' }}><i className="fa-solid fa-percent"></i></div>
          </div>
          <div className="ai-kpi-value" style={{ position: 'relative', zIndex: 2, fontSize: '1.4rem' }}>%{ceiVal.toFixed(1)}</div>
          <div className="ai-kpi-sub" style={{ position: 'relative', zIndex: 2 }}>Collection Effectiveness Index</div>
        </div>

        <div className="ai-kpi-card" style={{ background: 'rgba(18,23,38,0.95)', border: '1px solid rgba(246,187,77,0.15)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-15px', right: '-15px', width: '80px', height: '80px', background: 'rgba(246,187,77,0.1)', filter: 'blur(30px)', borderRadius: '50%' }}></div>
          <div className="ai-kpi-header" style={{ position: 'relative', zIndex: 2 }}>
            <span>Kapsama Süresi</span>
            <div className="ai-kpi-icon" style={{ background: 'rgba(246,187,77,0.15)', color: '#F6BB4D', boxShadow: '0 0 10px rgba(246,187,77,0.2)' }}><i className="fa-solid fa-hourglass-half"></i></div>
          </div>
          <div className="ai-kpi-value" style={{ position: 'relative', zIndex: 2, fontSize: '1.4rem' }}>{coverageMonths !== null ? `${coverageMonths.toFixed(1)} Ay` : '—'}</div>
          <div className="ai-kpi-sub" style={{ position: 'relative', zIndex: 2 }}>Net Alacak / Aylık Tahsilat</div>
        </div>
      </div>

      <div className="ai-hub-tab-content">
        <div className="grid-two-col">
          <div className="hub-card">
            <div className="hub-card-header">
              <span className="hub-card-title">
                <i className="fa-solid fa-chart-pie"></i> Pareto 80/20 Alacak Yoğunlaşması
              </span>
              <span className="badge-pill purple">%{paretoVal} Yoğunluk</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#9BA6BC', margin: 0 }}>
              En yüksek bakiyeli %20 cari müşteri grubunun toplam şirket alacağındaki payı.
            </p>
            <div className="pareto-card-list" style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {paretoData.debtPareto.topDebtors.map((c: any, i: number) => (
                <div 
                  key={c.customerId} 
                  className="pareto-minimal-card" 
                  onClick={() => triggerOpenCustomerModal(c.original || c)}
                  style={{ 
                    position: 'relative', 
                    overflow: 'hidden', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    padding: '14px 16px', 
                    background: 'rgba(18,23,38,0.97)', 
                    backdropFilter: 'blur(24px)', 
                    borderRadius: '12px', 
                    border: '1px solid rgba(255,255,255,0.06)', 
                    cursor: 'pointer', 
                    transition: 'all 0.2s ease' 
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(18,23,38,0.97)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ 
                        width: '34px', height: '34px', borderRadius: '10px', 
                        background: i < 3 ? 'rgba(251, 123, 133, 0.15)' : 'rgba(59,130,246,0.1)', 
                        color: i < 3 ? '#FB7B85' : '#3B82F6', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        fontSize: '0.9rem', fontWeight: 'bold', border: `1px solid ${i < 3 ? 'rgba(251, 123, 133, 0.3)' : 'rgba(59,130,246,0.2)'}` 
                      }}>
                        {i + 1}
                      </div>
                      <div>
                        <div style={{ color: '#F6F8FC', fontWeight: 600, fontSize: '0.95rem' }}>{cleanName(c.name)}</div>
                        <div style={{ color: '#9BA6BC', fontSize: '0.75rem', marginTop: '4px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <i className="fa-solid fa-clock-rotate-left" style={{ fontSize: '0.7rem' }}></i> Vadesi Geçen: 
                            <strong style={{ color: (c.overdueBalance || 0) > 0 ? '#FB7B85' : '#3DDC9A' }}>
                              {formatCurrency(c.overdueBalance || 0)}
                            </strong>
                          </span>
                          <span style={{ color: '#5C6479' }}>•</span>
                          <span style={{ color: '#A78BFA' }}>%{c.share} Yoğunluk</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                      <div className="num" style={{ color: '#F6F8FC', fontWeight: 700, fontSize: '1.05rem', letterSpacing: '0.5px' }}>
                        {formatCurrency(c.value || 0)}
                      </div>
                      <span className={`badge-pill ${(c.overdueBalance || 0) > 50000 ? 'red' : ((c.overdueBalance || 0) > 0 ? 'amber' : 'green')}`} style={{ padding: '4px 8px', fontSize: '0.65rem' }}>
                        {(c.overdueBalance || 0) > 50000 ? 'Yüksek Risk' : ((c.overdueBalance || 0) > 0 ? 'Orta Risk' : 'Düşük Risk')}
                      </span>
                    </div>
                  </div>
                  
                  {/* Share Progress Bar Background */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${Math.min(100, c.share || 0)}%`, 
                      background: i < 3 ? 'linear-gradient(90deg, transparent, #FB7B85)' : 'linear-gradient(90deg, transparent, #3B82F6)',
                      boxShadow: i < 3 ? '0 0 8px rgba(251, 123, 133, 0.4)' : '0 0 8px rgba(59, 130, 246, 0.4)'
                    }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="hub-card">
            <div className="hub-card-header">
              <span className="hub-card-title">
                <i className="fa-solid fa-heart-pulse"></i> Kurumsal Sağlık & Enflasyon Maliyet Yükü
              </span>
              <span className={`badge-pill ${(finHealthData.healthScore ?? 0) >= 65 ? 'green' : (finHealthData.healthScore ?? 0) >= 40 ? 'amber' : 'red'}`}>Skor: {finHealthData.healthScore ?? 0} / 100</span>
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '20px' }}>
              {/* Enflasyon Maliyet Drag Yükü Card */}
              <div style={{ 
                flex: 1, 
                position: 'relative', 
                overflow: 'hidden', 
                background: 'rgba(18,23,38,0.97)', 
                backdropFilter: 'blur(24px)', 
                padding: '20px', 
                borderRadius: '16px', 
                border: '1px solid rgba(251, 123, 133, 0.15)',
                boxShadow: 'inset 0 0 20px rgba(251, 123, 133, 0.03)'
              }}>
                <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'rgba(251, 123, 133, 0.1)', filter: 'blur(40px)', borderRadius: '50%' }}></div>
                <div style={{ position: 'relative', zIndex: 2 }}>
                  <div style={{ fontSize: '0.85rem', color: '#FB7B85', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(251, 123, 133, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="fa-solid fa-fire"></i>
                    </div>
                    Enflasyon Maliyet Drag Yükü
                  </div>
                  <div className="num" style={{ fontSize: '1.7rem', fontWeight: 700, color: '#F6F8FC', marginTop: '16px', letterSpacing: '-0.02em' }}>
                    {formatCurrency((totalOverdue || 0) * 0.045)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9BA6BC', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-circle-info" style={{ color: '#5C6479' }}></i>
                    Aylık %4.5 enflasyon aşınması baz alınmıştır
                  </div>
                </div>
              </div>
              
              {/* Ortalama Portfolio Vadesi Card */}
              <div style={{ 
                flex: 1, 
                position: 'relative', 
                overflow: 'hidden', 
                background: 'rgba(18,23,38,0.97)', 
                backdropFilter: 'blur(24px)', 
                padding: '20px', 
                borderRadius: '16px', 
                border: '1px solid rgba(246, 187, 77, 0.15)',
                boxShadow: 'inset 0 0 20px rgba(246, 187, 77, 0.03)'
              }}>
                <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'rgba(246, 187, 77, 0.1)', filter: 'blur(40px)', borderRadius: '50%' }}></div>
                <div style={{ position: 'relative', zIndex: 2 }}>
                  <div style={{ fontSize: '0.85rem', color: '#F6BB4D', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(246, 187, 77, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="fa-solid fa-clock-rotate-left"></i>
                    </div>
                    Ortalama Portfolio Vadesi
                  </div>
                  <div className="num" style={{ fontSize: '1.7rem', fontWeight: 700, color: '#F6F8FC', marginTop: '16px', letterSpacing: '-0.02em' }}>
                    {finHealthData.agingDistribution.averageVade || 0} Gün
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9BA6BC', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-bullseye" style={{ color: '#5C6479' }}></i>
                    Ağırlıklı Ödeme Vadesi (Genel Şirket)
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', padding: '0 16px', color: '#5C6479', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <div style={{ flex: 1.5 }}>Vade Dilimi</div>
                <div style={{ flex: 1, textAlign: 'right' }}>Müşteri Sayısı</div>
                <div style={{ flex: 1.2, textAlign: 'right' }}>Toplam Tutar</div>
                <div style={{ width: '100px', textAlign: 'right' }}>Etki</div>
              </div>

              {/* Row 1: Normal */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '16px', background: 'rgba(18,23,38,0.7)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ flex: 1.5, display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3DDC9A', boxShadow: '0 0 8px rgba(61, 220, 154, 0.6)' }}></div>
                  <span style={{ color: '#F6F8FC', fontWeight: 600, fontSize: '0.9rem' }}>0 - 30 Gün (Cari)</span>
                </div>
                <div className="num" style={{ flex: 1, textAlign: 'right', color: '#9BA6BC', fontSize: '0.95rem' }}>{finHealthData.agingDistribution.currentCustCount ?? 0}</div>
                <div className="num" style={{ flex: 1.2, textAlign: 'right', color: '#F6F8FC', fontWeight: 600, fontSize: '1rem' }}>{formatCurrency(finHealthData.agingDistribution.current || 0)}</div>
                <div style={{ width: '100px', textAlign: 'right' }}>
                  <span className="badge-pill green" style={{ padding: '4px 10px' }}>Normal</span>
                </div>
              </div>

              {/* Row 2: Orta Uyarı */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '16px', background: 'rgba(245, 158, 11, 0.03)', borderRadius: '12px', border: '1px solid rgba(246, 187, 77, 0.15)' }}>
                <div style={{ flex: 1.5, display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F6BB4D', boxShadow: '0 0 8px rgba(246, 187, 77, 0.6)' }}></div>
                  <span style={{ color: '#F6F8FC', fontWeight: 600, fontSize: '0.9rem' }}>31 - 60 Gün Gecikme</span>
                </div>
                <div className="num" style={{ flex: 1, textAlign: 'right', color: '#9BA6BC', fontSize: '0.95rem' }}>{finHealthData.agingDistribution.days30CustCount ?? 0}</div>
                {/* DÜZELTME (Bulgu 8): 31-60 gün satırı artık days60 yerine kendi dilimi olan days30 tutarını gösteriyor. */}
                <div className="num" style={{ flex: 1.2, textAlign: 'right', color: '#F6BB4D', fontWeight: 700, fontSize: '1rem' }}>{formatCurrency(finHealthData.agingDistribution.days30 || 0)}</div>
                <div style={{ width: '100px', textAlign: 'right' }}>
                  <span className="badge-pill amber" style={{ padding: '4px 10px' }}>Orta Uyarı</span>
                </div>
              </div>

              {/* Row 3: Kritik Risk */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '16px', background: 'rgba(251, 123, 133, 0.05)', borderRadius: '12px', border: '1px solid rgba(251, 123, 133, 0.2)' }}>
                <div style={{ flex: 1.5, display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FB7B85', boxShadow: '0 0 8px rgba(251, 123, 133, 0.6)' }}></div>
                  <span style={{ color: '#F6F8FC', fontWeight: 600, fontSize: '0.9rem' }}>61 - 90+ Gün Kritik Gecikme</span>
                </div>
                <div className="num" style={{ flex: 1, textAlign: 'right', color: '#9BA6BC', fontSize: '0.95rem' }}>{finHealthData.agingDistribution.days60PlusCustCount ?? 0}</div>
                {/* DÜZELTME (Bulgu 8): 61-90+ gün satırı artık yalnızca days90Plus değil, days60 + days90Plus toplamını gösteriyor (etiketle tutarlı: 61-90+ gün). */}
                <div className="num" style={{ flex: 1.2, textAlign: 'right', color: '#FB7B85', fontWeight: 700, fontSize: '1.05rem' }}>{formatCurrency((finHealthData.agingDistribution.days60 || 0) + (finHealthData.agingDistribution.days90Plus || 0))}</div>
                <div style={{ width: '100px', textAlign: 'right' }}>
                  <span className="badge-pill red" style={{ padding: '4px 10px', boxShadow: '0 2px 8px rgba(251, 123, 133, 0.25)' }}>Kritik Risk</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

        <div className="hub-card" style={{ marginTop: '24px', background: 'linear-gradient(145deg, rgba(139, 92, 246, 0.05) 0%, rgba(13, 17, 28, 0.95) 100%)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
          <div className="hub-card-header">
            <span className="hub-card-title" style={{ color: '#A78BFA' }}>
              <i className="fa-solid fa-brain" style={{ marginRight: '8px' }}></i>
              Günlü (AI) Analiz Özeti
            </span>
            {finHealthData.riskLevel && (
              <span className="badge-pill" style={{ background: `${finHealthData.riskColor}22`, color: finHealthData.riskColor, border: `1px solid ${finHealthData.riskColor}55` }}>
                {finHealthData.riskLevel}
              </span>
            )}
          </div>
          <div style={{ padding: '16px', color: '#F6F8FC', lineHeight: '1.6', fontSize: '0.9rem' }}>
            Şirket genelinde toplam <strong style={{ color: '#3B82F6' }}>{formatCurrency(globalSummary.totalNetReceivables)}</strong> net alacak bulunmaktadır.
            Bunun <strong style={{ color: '#FB7B85' }}>{formatCurrency(totalOverdue || 0)}</strong> kısmı vadesi geçmiş borçlardan oluşmaktadır.
            Koleksiyon Etkinlik İndeksi (CEI) <strong style={{ color: '#3DDC9A' }}>%{ceiVal.toFixed(1)}</strong> seviyesindedir.
            Vadesi geçen alacakların enflasyon (drag) yükü, nakit akışını olumsuz etkilemektedir. Geciken bakiyelerin tahsilatına ağırlık verilmesi ve Pareto'nun %20'lik risk grubuna (<strong style={{ color: '#A78BFA' }}>%{paretoVal} Yoğunluk</strong>) odaklanılması önerilmektedir.
            {finHealthData.actionRecommendation && (
              <>
                <br /><br />
                <strong style={{ color: '#A78BFA' }}>💡 Önerilen Aksiyon:</strong> {finHealthData.actionRecommendation}
              </>
            )}
          </div>
        </div>

        <div className="ai-hub-chips-bar" style={{ marginTop: '24px' }}>
        <div className="chips-bar-label">
          <i className="fa-solid fa-wand-magic-sparkles" style={{ color: '#8B5CF6' }}></i>
          Günlü AI Akıllı Sorular
        </div>
        <div className="chips-wrapper">
          <button className="ai-query-chip" onClick={() => handleQuickQuestion('Şirket genelinde vadesi 90 günü geçen tüm alacakları listeleyip risk raporu çıkarır mısın?')}>
            <i className="fa-solid fa-triangle-exclamation" style={{ color: '#FB7B85' }}></i>
            90 Gün Üzeri Kritik Borçlu Raporu
          </button>
        </div>
      </div>
    </div>
  );
}
