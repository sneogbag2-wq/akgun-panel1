const fs = require('fs');
const path = 'c:\\Users\\monds\\Desktop\\test\\panel\\src\\pages\\AiRepPerformancePage.tsx';

const newContent = `import React, { useState, useEffect, useMemo } from 'react';
import { 
  getMonthlySalesRepPerformanceSync,
  subscribeDataChange
} from '../services/customerService';
import { formatCurrency } from '../utils/formatters';
import { MascotAvatar } from '../components/ai/MascotAvatar';
import { useAiChat } from '../hooks/useAiChat';
import './AiAnalyticsHubPage.css';

export default function AiRepPerformancePage() {
  const [dataVersion, setDataVersion] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState('');
  const { sendMessage } = useAiChat();

  useEffect(() => {
    return subscribeDataChange(() => {
      setDataVersion(prev => prev + 1);
    });
  }, []);

  const repPerformance = useMemo(() => getMonthlySalesRepPerformanceSync(selectedMonth), [dataVersion, selectedMonth]);
  const repList = repPerformance?.repList || [];

  const handleQuickQuestion = (promptText: string) => {
    window.dispatchEvent(new CustomEvent('open-ai-chat', { detail: { prompt: promptText } }));
  };

  const totalSales = repList.reduce((sum: number, r: any) => sum + (r.monthSales || 0), 0);
  const totalCollections = repList.reduce((sum: number, r: any) => sum + (r.monthCollections || 0), 0);
  const totalPrim = repList.reduce((sum: number, r: any) => sum + (r.primResult?.prim || 0), 0);
  const avgCollectionRate = totalSales > 0 ? (totalCollections / totalSales) * 100 : 0;
  const topRep = repList.length > 0 ? repList.reduce((prev: any, curr: any) => (curr.primResult?.toplamPuan || 0) > (prev.primResult?.toplamPuan || 0) ? curr : prev, repList[0]) : null;

  return (
    <div className="ai-hub-container">
      <div className="ai-hub-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="ai-hub-title-group">
          <div className="ai-hub-mascot-box">
            <MascotAvatar size="small" />
          </div>
          <div className="ai-hub-title-text">
            <h1>
              Temsilci Performans Karnesi
              <span className="ai-hub-badge">
                <i className="fa-solid fa-circle" style={{ fontSize: '8px' }}></i> CFO AI Aktif
              </span>
            </h1>
            <div className="ai-hub-subtitle">Plasiyer Tahsilat ve Ciro Analizi (Prim Hakedişleri Dahil)</div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ fontSize: '0.85rem', color: '#9BA6BC', fontWeight: 600 }}>Dönem:</label>
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ 
              background: 'rgba(255,255,255,0.05)', 
              border: '1px solid rgba(255,255,255,0.1)', 
              color: '#F6F8FC', 
              padding: '8px 16px', 
              borderRadius: '8px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="">Bu Ay (Varsayılan)</option>
            <option value="2026-07">Temmuz 2026</option>
            <option value="2026-06">Haziran 2026</option>
            <option value="2026-05">Mayıs 2026</option>
          </select>
        </div>
      </div>

      <div className="ai-hub-kpi-strip" style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div className="ai-kpi-card" style={{ background: 'rgba(18,23,38,0.95)', border: '1px solid rgba(59,130,246,0.15)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'rgba(59,130,246,0.1)', filter: 'blur(40px)', borderRadius: '50%' }}></div>
          <div className="ai-kpi-header" style={{ position: 'relative', zIndex: 2 }}>
            <span>Aktif Satış Temsilcisi</span>
            <div className="ai-kpi-icon" style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6', boxShadow: '0 0 10px rgba(59,130,246,0.2)' }}><i className="fa-solid fa-users"></i></div>
          </div>
          <div className="ai-kpi-value" style={{ position: 'relative', zIndex: 2, fontSize: '1.6rem' }}>{repList.length}</div>
          <div className="ai-kpi-sub" style={{ position: 'relative', zIndex: 2 }}>Saha & Merkez Ekipleri</div>
        </div>

        <div className="ai-kpi-card" style={{ background: 'rgba(18,23,38,0.95)', border: '1px solid rgba(61,220,154,0.15)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'rgba(61,220,154,0.1)', filter: 'blur(40px)', borderRadius: '50%' }}></div>
          <div className="ai-kpi-header" style={{ position: 'relative', zIndex: 2 }}>
            <span>Ortalama Tahsilat Oranı</span>
            <div className="ai-kpi-icon" style={{ background: 'rgba(61,220,154,0.15)', color: '#3DDC9A', boxShadow: '0 0 10px rgba(61,220,154,0.2)' }}><i className="fa-solid fa-percent"></i></div>
          </div>
          <div className="ai-kpi-value" style={{ position: 'relative', zIndex: 2, fontSize: '1.6rem' }}>%{(avgCollectionRate).toFixed(1)}</div>
          <div className="ai-kpi-sub" style={{ position: 'relative', zIndex: 2 }}>Genel Başarı İndeksi</div>
        </div>
        
        <div className="ai-kpi-card" style={{ background: 'rgba(18,23,38,0.95)', border: '1px solid rgba(139, 92, 246, 0.15)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'rgba(139, 92, 246, 0.1)', filter: 'blur(40px)', borderRadius: '50%' }}></div>
          <div className="ai-kpi-header" style={{ position: 'relative', zIndex: 2 }}>
            <span style={{ color: '#A78BFA' }}>Dağıtılan Toplam Prim</span>
            <div className="ai-kpi-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#A78BFA', boxShadow: '0 0 10px rgba(139, 92, 246, 0.2)' }}><i className="fa-solid fa-sack-dollar"></i></div>
          </div>
          <div className="ai-kpi-value" style={{ position: 'relative', zIndex: 2, fontSize: '1.6rem', color: '#F6F8FC' }}>{formatCurrency(totalPrim)}</div>
          <div className="ai-kpi-sub" style={{ position: 'relative', zIndex: 2 }}>Tüm Ekipler Hakediş Toplamı</div>
        </div>

        <div className="ai-kpi-card" style={{ background: 'rgba(18,23,38,0.95)', border: '1px solid rgba(245,158,11,0.15)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'rgba(245,158,11,0.1)', filter: 'blur(40px)', borderRadius: '50%' }}></div>
          <div className="ai-kpi-header" style={{ position: 'relative', zIndex: 2 }}>
            <span style={{ color: '#F6BB4D' }}>Ayın En Başarılı Temsilcisi</span>
            <div className="ai-kpi-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#F6BB4D', boxShadow: '0 0 10px rgba(245,158,11,0.2)' }}><i className="fa-solid fa-crown"></i></div>
          </div>
          <div className="ai-kpi-value" style={{ position: 'relative', zIndex: 2, fontSize: '1.3rem', color: '#F6BB4D' }}>{topRep ? topRep.repName : '-'}</div>
          <div className="ai-kpi-sub" style={{ position: 'relative', zIndex: 2 }}>{topRep ? \`Puan: \${(topRep.primResult?.toplamPuan || 0).toFixed(1)} / 150\` : 'Puan Lideri'}</div>
        </div>
      </div>

      <div className="ai-hub-tab-content" style={{ marginTop: '24px' }}>
        <div className="hub-card" style={{ padding: '24px' }}>
          <div className="hub-card-header" style={{ marginBottom: '20px' }}>
            <span className="hub-card-title">
              <i className="fa-solid fa-user-gear"></i> Plasiyer & Satış Temsilcisi Performans Analizi
            </span>
            <span className="badge-pill purple" style={{ fontSize: '0.8rem', padding: '4px 12px' }}>{repList.length} Temsilci</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', padding: '0 16px', color: '#5C6479', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              <div style={{ width: '40px' }}>#</div>
              <div style={{ flex: 2 }}>Temsilci Adı</div>
              <div style={{ flex: 1.2, textAlign: 'right' }}>Ciro</div>
              <div style={{ flex: 1.2, textAlign: 'right' }}>Tahsilat</div>
              <div style={{ flex: 1, textAlign: 'center' }}>Risk Seviyesi</div>
              <div style={{ flex: 1.2, textAlign: 'right' }}>Perf. Puanı</div>
              <div style={{ width: '70px', textAlign: 'center' }}>Not</div>
              <div style={{ flex: 1.5, textAlign: 'right' }}>Prim Hakediş</div>
            </div>

            {repList.map((r: any, idx: number) => {
              const riskColor = (r.riskLevel === 'Yüksek Risk' || r.riskLevel === 'Kritik Risk') ? '#FB7B85' : ((r.riskLevel === 'Orta Risk') ? '#F6BB4D' : '#3DDC9A');
              const riskBg = (r.riskLevel === 'Yüksek Risk' || r.riskLevel === 'Kritik Risk') ? 'rgba(251, 123, 133, 0.15)' : ((r.riskLevel === 'Orta Risk') ? 'rgba(246, 187, 77, 0.15)' : 'rgba(61, 220, 154, 0.15)');
              
              const notRenk = r.primResult?.harfNotu === 'A' ? '#3DDC9A' : r.primResult?.harfNotu === 'B' ? '#3B82F6' : r.primResult?.harfNotu === 'C' ? '#F6BB4D' : '#FB7B85';
              const notBg = r.primResult?.harfNotu === 'A' ? 'rgba(61, 220, 154, 0.15)' : r.primResult?.harfNotu === 'B' ? 'rgba(59, 130, 246, 0.15)' : r.primResult?.harfNotu === 'C' ? 'rgba(246, 187, 77, 0.15)' : 'rgba(251, 123, 133, 0.15)';
              
              const erimeMiktari = r.primResult?.netErime || 0;
              const erimeRengi = erimeMiktari >= 0 ? '#3DDC9A' : '#FB7B85';

              return (
                <div key={idx} style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  padding: '16px', 
                  background: 'rgba(18,23,38,0.7)', 
                  borderRadius: '12px', 
                  border: '1px solid rgba(255,255,255,0.04)',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  const tooltip = e.currentTarget.querySelector('.ai-tooltip') as HTMLElement;
                  if(tooltip) tooltip.style.display = 'block';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(18,23,38,0.7)';
                  const tooltip = e.currentTarget.querySelector('.ai-tooltip') as HTMLElement;
                  if(tooltip) tooltip.style.display = 'none';
                }}>
                  
                  {/* AI Hover Tooltip */}
                  <div className="ai-tooltip" style={{
                    display: 'none',
                    position: 'absolute',
                    top: '-60px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(13,17,28,0.95)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    color: '#F6F8FC',
                    fontSize: '0.85rem',
                    width: 'max-content',
                    maxWidth: '350px',
                    zIndex: 10,
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    pointerEvents: 'none'
                  }}>
                    <div style={{ color: '#A78BFA', fontWeight: 600, marginBottom: '4px', fontSize: '0.75rem' }}><i className="fa-solid fa-robot"></i> Günlü Analizi</div>
                    {r.primResult?.harfNotu === 'A' ? 
                      \`\${r.repName} mükemmel bir performans sergiledi. Ay başı \${formatCurrency(r.primResult.ayBasiBakiye)} olan risk bakiyesini hızla eriterek net \${formatCurrency(erimeMiktari)} tahsilat sağladı.\` : 
                      r.primResult?.harfNotu === 'B' ?
                      \`\${r.repName} istikrarlı bir tahsilat yürüttü. Yaşlanan bakiye kontrol altında, ciro hedeflerine yaklaştı.\` :
                      \`\${r.repName} için risk durumu yüksek. Tahsilatlar, kesilen faturanın (\${formatCurrency(r.monthSales)}) altında kaldı. Yakın takip önerilir.\`
                    }
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: '40px', color: '#5C6479', fontWeight: 600, fontSize: '0.9rem' }}>{idx + 1}</div>
                    <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E2E8F0', fontSize: '0.9rem' }}>
                        <i className="fa-solid fa-user"></i>
                      </div>
                      <div>
                          <div style={{ color: '#F6F8FC', fontWeight: 600, fontSize: '0.95rem' }}>{r.repName}</div>
                          <div style={{ fontSize: '0.7rem', color: '#9BA6BC' }}>{r.customerCount || 0} Cari</div>
                      </div>
                    </div>
                    <div className="num" style={{ flex: 1.2, textAlign: 'right', color: '#9BA6BC', fontSize: '0.9rem' }}>{formatCurrency(r.monthSales || 0)}</div>
                    <div className="num" style={{ flex: 1.2, textAlign: 'right', color: '#E2E8F0', fontWeight: 500, fontSize: '0.9rem' }}>{formatCurrency(r.monthCollections || 0)}</div>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '999px', 
                        fontSize: '0.7rem', 
                        fontWeight: 600, 
                        color: riskColor,
                        background: riskBg,
                        border: \`1px solid \${riskColor}40\`
                      }}>
                        {r.riskLevel || 'Düşük Risk'}
                      </span>
                    </div>
                    <div className="num" style={{ flex: 1.2, textAlign: 'right', color: '#F6F8FC', fontWeight: 700, fontSize: '1.05rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                      {(r.primResult?.toplamPuan || 0).toFixed(1)} <span style={{ fontSize: '0.7rem', color: '#5C6479', fontWeight: 500 }}>/ 150</span>
                    </div>
                    <div style={{ width: '70px', textAlign: 'center' }}>
                       <span style={{ 
                        padding: '4px 12px', 
                        borderRadius: '6px', 
                        fontSize: '0.85rem', 
                        fontWeight: 700, 
                        color: notRenk,
                        background: notBg,
                        border: \`1px solid \${notRenk}40\`
                      }}>
                        {r.primResult?.harfNotu || '-'}
                      </span>
                    </div>
                    <div className="num" style={{ flex: 1.5, textAlign: 'right', color: (r.primResult?.prim || 0) > 0 ? '#3DDC9A' : '#FB7B85', fontWeight: 700, fontSize: '1.1rem' }}>
                      {formatCurrency(r.primResult?.prim || 0)}
                    </div>
                  </div>

                  {/* Detay Paneli: Ay Başı / Ay Sonu Cari ve Erime */}
                  <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '32px', paddingLeft: '52px' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#5C6479', fontWeight: 600, textTransform: 'uppercase' }}>Ay Başı Bakiye</div>
                      <div className="num" style={{ fontSize: '0.9rem', color: '#9BA6BC', marginTop: '2px' }}>{formatCurrency(r.primResult?.ayBasiBakiye || 0)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#5C6479', fontWeight: 600, textTransform: 'uppercase' }}>Ay Sonu Bakiye</div>
                      <div className="num" style={{ fontSize: '0.9rem', color: '#F6F8FC', marginTop: '2px' }}>{formatCurrency(r.primResult?.aySonuBakiye || r.totalNetReceivables || 0)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#5C6479', fontWeight: 600, textTransform: 'uppercase' }}>Net Erime (Tahsilat - Fatura)</div>
                      <div className="num" style={{ fontSize: '0.9rem', color: erimeRengi, fontWeight: 600, marginTop: '2px' }}>
                        {erimeMiktari > 0 ? '+' : ''}{formatCurrency(erimeMiktari)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#5C6479', fontWeight: 600, textTransform: 'uppercase' }}>Yaşlanan Bakiye Değişimi</div>
                      <div className="num" style={{ fontSize: '0.9rem', color: '#F6BB4D', marginTop: '2px' }}>
                        {formatCurrency(r.primResult?.ayBasiYaslanan || 0)} <i className="fa-solid fa-arrow-right" style={{fontSize:'0.7rem', margin: '0 4px', opacity: 0.5}}></i> {formatCurrency(r.primResult?.aySonuYaslanan || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {repList.length === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', color: '#9BA6BC', background: 'rgba(18,23,38,0.7)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <i className="fa-solid fa-folder-open" style={{ fontSize: '2rem', marginBottom: '12px', opacity: 0.5 }}></i>
                <div>Bu döneme ait temsilci verisi bulunamadı veya tüm temsilcilerin müşteri sayısı %2 barajının altında.</div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="hub-card" style={{ marginTop: '24px', background: 'linear-gradient(145deg, rgba(139, 92, 246, 0.05) 0%, rgba(13, 17, 28, 0.95) 100%)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
        <div className="hub-card-header">
          <span className="hub-card-title" style={{ color: '#A78BFA' }}>
            <i className="fa-solid fa-brain" style={{ marginRight: '8px' }}></i>
            Günlü (AI) Performans ve Prim Özeti
          </span>
        </div>
        <div style={{ padding: '16px', color: '#F6F8FC', lineHeight: '1.6', fontSize: '0.9rem' }}>
          Toplam <strong>{repList.length}</strong> aktif temsilcinin genel tahsilat başarı oranı <strong style={{ color: '#3DDC9A' }}>%{(avgCollectionRate).toFixed(1)}</strong> seviyesindedir.
          Bu dönem dağıtılan toplam tahmini prim tutarı <strong style={{ color: '#A78BFA' }}>{formatCurrency(totalPrim)}</strong> olarak hesaplanmıştır.
          En yüksek performansı {topRep ? <strong style={{ color: '#F6BB4D' }}>{topRep.repName} ({(topRep.primResult?.toplamPuan || 0).toFixed(1)} Puan)</strong> : '-'} göstermektedir.
          Prim modeli net erime, tahsilat, cari azaltma ve risk durumlarını 4 boyutlu ağırlıklandırarak hakedişleri belirler.
        </div>
      </div>

      <div className="ai-hub-chips-bar" style={{ marginTop: '24px' }}>
        <div className="chips-bar-label">
          <i className="fa-solid fa-wand-magic-sparkles" style={{ color: '#8B5CF6' }}></i>
          Günlü AI Akıllı Sorular
        </div>
        <div className="chips-wrapper">
          <button className="ai-query-chip" onClick={() => handleQuickQuestion('Tüm satış temsilcilerinin tahsilat başarı oranlarını ve prim hakedişlerini özetle.')}>
            <i className="fa-solid fa-user-gear" style={{ color: '#9E7CFA' }}></i>
            Temsilci Tahsilat & Prim Karnesi
          </button>
        </div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync(path, newContent, 'utf8');
console.log('Patched AiRepPerformancePage.tsx');
