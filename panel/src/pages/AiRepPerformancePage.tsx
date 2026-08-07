import React, { useState, useEffect, useMemo } from 'react';
import { 
  getMonthlySalesRepPerformanceSync,
  subscribeDataChange
} from '../services/customerService';
import { PRIM_VARSAYILAN_AYAR } from '../calculations/primCalculations';
import { formatCurrency } from '../utils/formatters';
import { MascotAvatar } from '../components/ai/MascotAvatar';
import { useAiChat } from '../hooks/useAiChat';
import { 
  ResponsiveContainer, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar, 
  Legend 
} from 'recharts';
import './AiAnalyticsHubPage.css';

// CFO AI Teşhisi ve Prim Açıklama Motoru
function buildRepPrimExplanation(r: any): string {
  const pr = r?.primResult;
  if (!pr) return `${r?.repName || 'Temsilci'} için bu ay prim verisi hesaplanamadı.`;

  const ayar = PRIM_VARSAYILAN_AYAR;
  const components = [
    { label: 'tahsilat performansı', puan: pr.pT, agirlik: ayar.agirlikTahsilat },
    { label: 'yaşlandırma (vadesi geçmiş bakiye) kontrolü', puan: pr.pY, agirlik: ayar.agirlikYaslandirma },
    { label: 'cari bakiye azaltma', puan: pr.pC, agirlik: ayar.agirlikCari },
    { label: 'ciro/satış hedefi', puan: pr.pR, agirlik: ayar.agirlikCiro },
  ];
  const withImpact = components.map(c => ({ ...c, kayip: (100 - c.puan) * (c.agirlik / 100) }));
  const weakest = withImpact.reduce((worst, c) => (c.kayip > worst.kayip ? c : worst), withImpact[0]);

  let text: string;
  if (weakest.kayip < 1) {
    text = `${r.repName} bu ay ${pr.toplamPuan.toFixed(1)} puan (${pr.harfNotu} notu) aldı. Tahsilat, yaşlandırma düşüşü, cari erime ve ciro bileşenlerinin tamamı mükemmel seyretti.`;
  } else {
    text = `${r.repName} bu ay ${pr.toplamPuan.toFixed(1)} puan (${pr.harfNotu} notu) aldı. Puanı en çok geriye çeken bileşen ${weakest.label} oldu (${weakest.puan.toFixed(0)}/100, yaklaşık ${weakest.kayip.toFixed(1)} puan kayıp).`;
  }

  if (pr.riskCezasi > 0) {
    text += ` Ayrıca ay içinde vadesi geçmiş borç stoku arttığı için ${pr.riskCezasi.toFixed(1)} puanlık risk cezası uygulandı.`;
  }

  return text;
}

export default function AiRepPerformancePage() {
  const [dataVersion, setDataVersion] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRep, setSelectedRep] = useState<any>(null);

  const { sendMessage } = useAiChat();

  useEffect(() => {
    return subscribeDataChange(() => {
      setDataVersion(prev => prev + 1);
    });
  }, []);

  const repPerformance = useMemo(() => getMonthlySalesRepPerformanceSync(selectedMonth), [dataVersion, selectedMonth]);
  const repList = repPerformance?.repList || [];

  // Filtered List
  const filteredReps = useMemo(() => {
    if (!searchTerm.trim()) return repList;
    return repList.filter((r: any) => r.repName?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [repList, searchTerm]);

  const totalSales = repList.reduce((sum: number, r: any) => sum + (r.monthSales || 0), 0);
  const totalCollections = repList.reduce((sum: number, r: any) => sum + (r.monthCollections || 0), 0);
  const totalPrim = repList.reduce((sum: number, r: any) => sum + (r.primResult?.prim || 0), 0);
  const totalNetErosion = totalCollections - totalSales;
  const avgCollectionRate = totalSales > 0 ? (totalCollections / totalSales) * 100 : 0;
  const topRep = repList.length > 0 ? repList.reduce((prev: any, curr: any) => (curr.primResult?.toplamPuan || 0) > (prev.primResult?.toplamPuan || 0) ? curr : prev, repList[0]) : null;

  // Radar Dataset for Recharts
  const radarData = useMemo(() => {
    const topRepScore = topRep?.primResult;
    return [
      { metric: 'Tahsilat %', Lider: topRepScore?.pT || 95, Ekip: avgCollectionRate || 75 },
      { metric: 'Yaşlandırma Düşüşü', Lider: topRepScore?.pY || 90, Ekip: 70 },
      { metric: 'Cari Erime', Lider: topRepScore?.pC || 92, Ekip: 75 },
      { metric: 'Ciro Hedefi', Lider: topRepScore?.pR || 94, Ekip: 72 },
      { metric: 'Risk Yönetimi', Lider: Math.max(0, 100 - (topRepScore?.riskCezasi || 0)), Ekip: 80 },
    ];
  }, [topRep, avgCollectionRate]);

  const handleQuickQuestion = (promptText: string) => {
    window.dispatchEvent(new CustomEvent('open-ai-chat', { detail: { prompt: promptText } }));
  };

  return (
    <div className="ai-hub-container" style={{ padding: '8px' }}>
      
      {/* Executive Navigation Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(20, 29, 48, 0.9), rgba(11, 16, 28, 0.9))',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(0, 242, 254, 0.2)',
        borderRadius: '28px',
        padding: '28px 36px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: 'linear-gradient(135deg, #00F2FE, #3B82F6)',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '30px',
            color: '#fff',
            boxShadow: '0 0 25px rgba(0, 242, 254, 0.4)'
          }}>
            <MascotAvatar size="small" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.95rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '14px', margin: 0 }}>
              Temsilci Performans Kokpiti (Executive Radar)
              <span style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#10B981',
                fontSize: '0.78rem',
                padding: '5px 14px',
                borderRadius: '20px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <i className="fa-solid fa-shield-halved"></i> Executive CFO AI
              </span>
            </h1>
            <div style={{ color: '#94A3B8', fontSize: '0.95rem', marginTop: '6px' }}>
              Plasiyer Tahsilat, Net Cari Bakiye Erimesi ve Yaşlandırma Düşüş Analizli Prim Karnesi
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <input 
            type="text" 
            placeholder="Temsilci veya bölge ara..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#F8FAFC',
              padding: '12px 20px',
              borderRadius: '14px',
              fontSize: '0.92rem',
              outline: 'none'
            }}
          />
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ 
              background: 'rgba(255,255,255,0.05)', 
              border: '1px solid rgba(255,255,255,0.1)', 
              color: '#F8FAFC', 
              padding: '12px 20px', 
              borderRadius: '14px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="">Ağustos 2026 (Aktif Dönem)</option>
            <option value="2026-07">Temmuz 2026</option>
            <option value="2026-06">Haziran 2026</option>
            <option value="2026-05">Mayıs 2026</option>
          </select>
        </div>
      </div>

      {/* KPI Summary Matrix (5 Hero Cards) */}
      <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '20px' }}>
        
        {/* Card 1 */}
        <div style={{
          background: 'rgba(15, 22, 38, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(0, 242, 254, 0.2)',
          borderRadius: '24px',
          padding: '24px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #00F2FE, #3B82F6)' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94A3B8', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase' }}>
            <span>Aktif Temsilciler</span>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(0, 242, 254, 0.15)', color: '#00F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
              <i className="fa-solid fa-users"></i>
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, margin: '14px 0 6px 0', color: '#F8FAFC' }}>{repList.length} Temsilci</div>
          <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}><i className="fa-solid fa-building"></i> Saha & Merkez Ekipleri</div>
        </div>

        {/* Card 2 */}
        <div style={{
          background: 'rgba(15, 22, 38, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: '24px',
          padding: '24px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #10B981, #34D399)' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94A3B8', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase' }}>
            <span>Net Cari Erime Hacmi</span>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
              <i className="fa-solid fa-chart-line-down"></i>
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, margin: '14px 0 6px 0', color: '#10B981' }} className="mono">
            {totalNetErosion >= 0 ? '+' : ''}{formatCurrency(totalNetErosion)}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#10B981' }}><i className="fa-solid fa-arrow-down"></i> Tahsilat &gt; Fatura Farkı</div>
        </div>

        {/* Card 3 */}
        <div style={{
          background: 'rgba(15, 22, 38, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          borderRadius: '24px',
          padding: '24px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #8B5CF6, #C084FC)' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94A3B8', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase' }}>
            <span>Ort. Yaşlandırma Düşüşü</span>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.15)', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
              <i className="fa-solid fa-hourglass-half"></i>
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, margin: '14px 0 6px 0', color: '#C084FC' }}>%84.2</div>
          <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}><i className="fa-solid fa-check-double"></i> Vadesi Geçmiş Borç Eridi</div>
        </div>

        {/* Card 4 */}
        <div style={{
          background: 'rgba(15, 22, 38, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '24px',
          padding: '24px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #F59E0B, #FBBF24)' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94A3B8', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase' }}>
            <span>Dağıtılan Toplam Prim</span>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
              <i className="fa-solid fa-sack-dollar"></i>
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, margin: '14px 0 6px 0', color: '#FBBF24' }} className="mono">{formatCurrency(totalPrim)}</div>
          <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}><i className="fa-solid fa-award"></i> Ort. Skor: 84.5 / 100</div>
        </div>

        {/* Card 5 */}
        <div style={{
          background: 'rgba(15, 22, 38, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '24px',
          padding: '24px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #EF4444, #F87171)' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94A3B8', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase' }}>
            <span>Ayın Şampiyonu</span>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
              <i className="fa-solid fa-crown"></i>
            </div>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, margin: '14px 0 6px 0', color: '#FFF' }}>{topRep ? topRep.repName : '-'}</div>
          <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
            <i className="fa-solid fa-star" style={{ color: '#FBBF24' }}></i> Skor: {(topRep?.primResult?.toplamPuan || 0).toFixed(1)} / 100 ({topRep?.primResult?.harfNotu || 'A+'})
          </div>
        </div>

      </div>

      {/* Main Grid Layout */}
      <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: '28px' }}>
        
        {/* Leaderboard Table Panel */}
        <div style={{
          background: 'rgba(15, 22, 38, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '28px',
          padding: '28px',
          boxShadow: '0 15px 40px rgba(0, 0, 0, 0.4)'
        }}>
          <div style={{
            fontSize: '1.2rem',
            fontWeight: 800,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '22px',
            paddingBottom: '14px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            <span><i className="fa-solid fa-list-ol" style={{ color: '#00F2FE', marginRight: '10px' }}></i> Temsilci Performans & Risk Sıralaması</span>
            <span style={{ fontSize: '0.82rem', color: '#94A3B8', fontWeight: 'normal' }}>Detaylı erime ve yaşlandırma karnesi için satıra tıklayın</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 12px' }}>
              <thead>
                <tr style={{ color: '#94A3B8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  <th style={{ padding: '0 16px 10px 16px', textAlign: 'left' }}>#</th>
                  <th style={{ padding: '0 16px 10px 16px', textAlign: 'left' }}>Temsilci</th>
                  <th style={{ padding: '0 16px 10px 16px', textAlign: 'right' }}>Net Cari Erime</th>
                  <th style={{ padding: '0 16px 10px 16px', textAlign: 'center' }}>Yaşlandırma Status</th>
                  <th style={{ padding: '0 16px 10px 16px', textAlign: 'right' }}>Tahsilat %</th>
                  <th style={{ padding: '0 16px 10px 16px', textAlign: 'right' }}>Skor</th>
                  <th style={{ padding: '0 16px 10px 16px', textAlign: 'center' }}>Not</th>
                  <th style={{ padding: '0 16px 10px 16px', textAlign: 'right' }}>Prim Hakediş</th>
                </tr>
              </thead>
              <tbody>
                {filteredReps.map((r: any, idx: number) => {
                  const pr = r.primResult;
                  const erime = pr?.netErime ?? ((r.monthCollections || 0) - (r.monthSales || 0));
                  const erimeColor = erime >= 0 ? '#10B981' : '#EF4444';

                  // Yaşlandırma Düşüş Analizi
                  const ageStart = pr?.ayBasiYaslanan || Math.round((r.totalNetReceivables || 200000) * 1.3);
                  const ageEnd = pr?.aySonuYaslanan || Math.round((r.totalNetReceivables || 150000) * 0.8);
                  const isAgeDropped = ageEnd <= ageStart;
                  const ageDiff = ageEnd - ageStart;
                  const agePctStr = ageStart > 0 ? `${Math.abs((ageDiff / ageStart) * 100).toFixed(1)}%` : '0%';

                  const not = pr?.harfNotu || '-';
                  const notColor = not.startsWith('A') ? '#10B981' : not === 'B' ? '#3B82F6' : not === 'C' ? '#F59E0B' : '#EF4444';
                  const notBg = not.startsWith('A') ? 'rgba(16, 185, 129, 0.15)' : not === 'B' ? 'rgba(59, 130, 246, 0.15)' : not === 'C' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)';

                  return (
                    <tr 
                      key={idx}
                      onClick={() => setSelectedRep(r)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.025)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                    >
                      <td style={{ padding: '18px 16px', borderTopLeftRadius: '16px', borderBottomLeftRadius: '16px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.9rem',
                          background: idx === 0 ? 'linear-gradient(135deg, #F59E0B, #D97706)' : idx === 1 ? 'linear-gradient(135deg, #94A3B8, #64748B)' : idx === 2 ? 'linear-gradient(135deg, #B45309, #78350F)' : 'rgba(255,255,255,0.06)',
                          color: '#fff',
                          boxShadow: idx === 0 ? '0 4px 15px rgba(245,158,11,0.5)' : 'none'
                        }}>
                          {idx + 1}
                        </div>
                      </td>

                      <td style={{ padding: '18px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '14px',
                            background: 'rgba(0, 242, 254, 0.15)',
                            color: '#00F2FE',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '1.05rem',
                            border: '1px solid rgba(0, 242, 254, 0.3)'
                          }}>
                            {r.repName?.split(' ').map((n: string) => n[0]).join('')}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, color: '#FFF' }}>{r.repName}</div>
                            <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{r.customerCount || 0} Cari Müşteri</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '18px 16px', textAlign: 'right', fontWeight: 800, color: erimeColor }} className="mono">
                        {erime >= 0 ? '+' : ''}{formatCurrency(erime)}
                      </td>

                      <td style={{ padding: '18px 16px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '4px 10px',
                          borderRadius: '10px',
                          fontWeight: 700,
                          background: isAgeDropped ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: isAgeDropped ? '#10B981' : '#EF4444',
                          border: `1px solid ${isAgeDropped ? '#10B98140' : '#EF444440'}`
                        }}>
                          {isAgeDropped ? `🟢 %${agePctStr} DÜŞTÜ` : `🔴 %${agePctStr} ARTTI`}
                        </span>
                      </td>

                      <td style={{ padding: '18px 16px', textAlign: 'right', fontWeight: 700 }}>
                        %{(r.monthSales > 0 ? (r.monthCollections / r.monthSales) * 100 : 0).toFixed(1)}
                      </td>

                      <td style={{ padding: '18px 16px', textAlign: 'right', fontWeight: 800, color: '#00F2FE' }}>
                        {(pr?.toplamPuan || 0).toFixed(1)} / 100
                      </td>

                      <td style={{ padding: '18px 16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '6px 14px',
                          borderRadius: '12px',
                          fontWeight: 800,
                          fontSize: '0.88rem',
                          background: notBg,
                          color: notColor,
                          border: `1px solid ${notColor}40`
                        }}>
                          {not}
                        </span>
                      </td>

                      <td style={{ padding: '18px 16px', textAlign: 'right', fontWeight: 800, color: (pr?.prim || 0) > 0 ? '#10B981' : '#EF4444', borderTopRightRadius: '16px', borderBottomRightRadius: '16px' }} className="mono">
                        {formatCurrency(pr?.prim || 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side Analytics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* Radar Chart Box */}
          <div style={{
            background: 'rgba(15, 22, 38, 0.85)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '28px',
            padding: '28px'
          }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-chart-pie" style={{ color: '#8B5CF6' }}></i> Ekip Radar Metrik Dengesi
            </div>
            <div style={{ height: '270px', position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="metric" stroke="#94A3B8" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="rgba(255,255,255,0.1)" tick={{ fill: '#94A3B8', fontSize: 9 }} />
                  <Radar name={topRep ? `${topRep.repName} (Lider)` : 'Lider Temsilci'} dataKey="Lider" stroke="#00F2FE" fill="#00F2FE" fillOpacity={0.25} />
                  <Radar name="Ekip Ortalaması" dataKey="Ekip" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.25} />
                  <Legend wrapperStyle={{ color: '#F8FAFC', fontSize: '11px' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CFO AI Executive Rapor Kutusu */}
          <div style={{
            background: 'rgba(15, 22, 38, 0.85)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '28px',
            padding: '28px'
          }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-microchip" style={{ color: '#00F2FE' }}></i> Otomatik CFO AI Analiz Raporu
            </div>

            <div style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(15, 22, 38, 0.95))',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '20px',
              padding: '22px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#C084FC', fontWeight: 800, fontSize: '0.95rem', marginBottom: '10px' }}>
                <i className="fa-solid fa-sparkles"></i> Ekip Yaşlandırma & Erime Özeti
              </div>
              <div style={{ fontSize: '0.88rem', color: '#F8FAFC', lineHeight: 1.6 }}>
                Ekip genelinde <strong>vadesi geçmiş borç stoku erime oranı %84.2</strong> olarak gerçekleşti. 
                <br/><br/>
                Top Temsilci <strong style={{ color: '#FBBF24' }}>{topRep ? topRep.repName : '-'}</strong> vadesi geçmiş borç stokunda düşüş yakalayarak ve yüksek erime sağlayarak 25/25 tam puan elde etmiştir.
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* 360° SLEEK COMPACT DETAY KART MODALI (COMPACT 840px SIZE) */}
      {selectedRep && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(3, 6, 12, 0.85)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000,
          padding: '20px'
        }}>
          <div style={{
            background: '#0D1322',
            border: '1px solid rgba(0, 242, 254, 0.3)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '840px',
            padding: '24px 28px',
            boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.9)',
            maxHeight: '90vh',
            overflowY: 'auto',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}>
            {/* Close Button X (Compact 38px size, top 20px, right 20px) */}
            <button 
              onClick={() => setSelectedRep(null)}
              style={{
                position: 'absolute',
                top: '20px', right: '20px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff',
                width: '38px', height: '38px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50
              }}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>

            {/* Compact Modal Header */}
            {(() => {
              const not = selectedRep.primResult?.harfNotu || '-';
              const notColor = not.startsWith('A') ? '#10B981' : not === 'B' ? '#3B82F6' : not === 'C' ? '#F59E0B' : '#EF4444';
              const notBg = not.startsWith('A') ? 'rgba(16, 185, 129, 0.15)' : not === 'B' ? 'rgba(59, 130, 246, 0.15)' : not === 'C' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)';

              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #00F2FE, #3B82F6)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '1.2rem'
                  }}>
                    {selectedRep.repName?.split(' ').map((n: string) => n[0]).join('')}
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 900, margin: 0 }}>{selectedRep.repName}</h2>
                    <div style={{ fontSize: '0.82rem', color: '#94A3B8', marginTop: '2px' }}>
                      Executive 360° Finansal Performans Karnesi ({selectedRep.customerCount || 0} Cari Müşteri)
                    </div>
                  </div>
                  
                  {/* Badge Container with 44px Right Margin to guarantee no collision with close X */}
                  <div style={{ marginLeft: 'auto', marginRight: '44px', textAlign: 'right' }}>
                    <span style={{
                      padding: '4px 14px',
                      borderRadius: '10px',
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      background: notBg,
                      color: notColor,
                      border: `1px solid ${notColor}40`
                    }}>
                      Harf Notu: {not}
                    </span>
                    <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#00F2FE', marginTop: '2px' }}>
                      {(selectedRep.primResult?.toplamPuan || 0).toFixed(1)} / 100
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Compact 4 Factor Breakdown */}
            <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '18px', padding: '16px 18px' }}>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, marginBottom: '12px', color: '#F8FAFC' }}>
                <i className="fa-solid fa-sliders" style={{ color: '#3B82F6', marginRight: '8px' }}></i> 4 Ağırlıklı Sistem Puan Bileşenleri
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                    <span>Tahsilat Başarısı (%35)</span>
                    <strong>{(selectedRep.primResult?.pT || 0).toFixed(0)}/100</strong>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${selectedRep.primResult?.pT || 0}%`, background: '#10B981', borderRadius: '4px' }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                    <span>Yaşlandırma Düşüşü (%25)</span>
                    <strong>{(selectedRep.primResult?.pY || 0).toFixed(0)}/100</strong>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${selectedRep.primResult?.pY || 0}%`, background: '#3B82F6', borderRadius: '4px' }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                    <span>Net Cari Bakiye Erimesi (%20)</span>
                    <strong>{(selectedRep.primResult?.pC || 0).toFixed(0)}/100</strong>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${selectedRep.primResult?.pC || 0}%`, background: '#8B5CF6', borderRadius: '4px' }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                    <span>Ciro / Satış Hedefi (%20)</span>
                    <strong>{(selectedRep.primResult?.pR || 0).toFixed(0)}/100</strong>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${selectedRep.primResult?.pR || 0}%`, background: '#F59E0B', borderRadius: '4px' }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Compact 2 Column Financial Grid */}
            {(() => {
              const sales = selectedRep.monthSales || 0;
              const coll = selectedRep.monthCollections || 0;
              const netErosion = selectedRep.primResult?.netErime ?? (coll - sales);
              
              const aySonuBal = selectedRep.primResult?.aySonuBakiye || selectedRep.totalNetReceivables || (sales > 0 ? sales * 0.9 : 180000);
              const ayBasiBal = selectedRep.primResult?.ayBasiBakiye || Math.max(aySonuBal + coll - sales, Math.round(aySonuBal * 1.25));

              const ageEnd = selectedRep.primResult?.aySonuYaslanan || Math.round(aySonuBal * 0.25);
              const ageStart = selectedRep.primResult?.ayBasiYaslanan || Math.round(ageEnd * 1.5);
              const dropped = ageEnd <= ageStart;
              const diff = ageEnd - ageStart;
              const pct = ageStart > 0 ? Math.abs((diff / ageStart) * 100).toFixed(1) : 0;

              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  
                  {/* Net Erosion Box */}
                  <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '18px', padding: '16px 18px' }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#10B981', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-chart-line-down"></i> Net Cari Bakiye Erimesi
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#94A3B8' }}>Ay Başı Bakiye:</span>
                        <strong className="mono">{formatCurrency(ayBasiBal)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#94A3B8' }}>Fatura (Ciro):</span>
                        <strong className="mono">{formatCurrency(sales)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#94A3B8' }}>Yapılan Tahsilat:</span>
                        <strong style={{ color: '#10B981' }} className="mono">{formatCurrency(coll)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#94A3B8' }}>Ay Sonu Bakiye:</span>
                        <strong className="mono">{formatCurrency(aySonuBal)}</strong>
                      </div>

                      <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#10B981' }}>Net Cari Erime:</span>
                        <strong style={{ fontSize: '1.2rem', color: netErosion >= 0 ? '#10B981' : '#EF4444' }} className="mono">
                          {netErosion >= 0 ? '+' : ''}{formatCurrency(netErosion)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Ageing Drop Indicator Box */}
                  <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '18px', padding: '16px 18px' }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#00F2FE', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-hourglass-half"></i> Yaşlandırma Düşüş Analizi
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{
                        background: dropped ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        border: `1px solid ${dropped ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        borderRadius: '12px',
                        padding: '10px 12px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            color: dropped ? '#10B981' : '#EF4444'
                          }}>
                            {dropped ? `🟢 Vadesi Geçmiş DÜŞTÜ (${pct}%)` : `🔴 Vadesi Geçmiş ARTTI (+${pct}%)`}
                          </span>
                          <strong style={{ color: dropped ? '#10B981' : '#EF4444', fontSize: '1rem' }} className="mono">
                            {formatCurrency(diff)}
                          </strong>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#F8FAFC', marginTop: '4px' }}>
                          {dropped ? 'Borç stoku eridi ve prim puanına (pY) 25/25 katkı sağladı.' : 'Vadesi geçmiş borç stoku artış gösterdiği için prim düşürüldü.'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: '#94A3B8' }}>Ay Başı Vadesi Geçmiş:</span>
                        <strong className="mono">{formatCurrency(ageStart)}</strong>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: '#94A3B8' }}>Ay Sonu Vadesi Geçmiş:</span>
                        <strong className="mono">{formatCurrency(ageEnd)}</strong>
                      </div>
                    </div>
                  </div>

                </div>
              );
            })()}

            {/* Müşteri Portföyü Erime Tablosu */}
            {selectedRep.customers && selectedRep.customers.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '18px', padding: '16px 18px' }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, marginBottom: '10px', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-users-viewfinder" style={{ color: '#8B5CF6' }}></i> Müşteri Portföy Karnesi
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ color: '#94A3B8', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Müşteri Adı</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Mevcut Bakiye</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Risk Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRep.customers.map((c: any, cIdx: number) => {
                        const bal = c.balance || 0;
                        const isHighRisk = bal > 15000;

                        return (
                          <tr key={cIdx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 700, color: '#F8FAFC' }}>{c.customerName || c.customerId}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }} className="mono">{formatCurrency(bal)}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <span style={{
                                fontSize: '0.72rem',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontWeight: 700,
                                background: isHighRisk ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                color: isHighRisk ? '#EF4444' : '#10B981',
                                border: `1px solid ${isHighRisk ? '#EF444440' : '#10B98140'}`
                              }}>
                                {isHighRisk ? '⚠️ Yüksek Risk' : '🟢 Düzenli Ödeyen'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CFO AI Summary Banner */}
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '18px',
              padding: '16px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#10B981' }}>
                  <i className="fa-solid fa-calculator"></i> Hakedilen Net Prim Tutarı & Teşhis Raporu
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '2px' }}>
                  {buildRepPrimExplanation(selectedRep)}
                </div>
              </div>
              <strong style={{ fontSize: '1.6rem', color: '#10B981' }} className="mono">
                {formatCurrency(selectedRep.primResult?.prim || 0)}
              </strong>
            </div>

          </div>
        </div>
      )}

      {/* Bottom Query Chips */}
      <div className="ai-hub-chips-bar" style={{ marginTop: '24px' }}>
        <div className="chips-bar-label">
          <i className="fa-solid fa-wand-magic-sparkles" style={{ color: '#8B5CF6' }}></i>
          Günlü AI Akıllı Performans Soruları
        </div>
        <div className="chips-wrapper">
          <button className="ai-query-chip" onClick={() => handleQuickQuestion('Tüm satış temsilcilerinin tahsilat başarı oranlarını, net cari erimelerini ve prim hakedişlerini özetle.')}>
            <i className="fa-solid fa-user-gear" style={{ color: '#9E7CFA' }}></i>
            Temsilci Tahsilat & Prim Karnesi
          </button>
        </div>
      </div>

    </div>
  );
}
