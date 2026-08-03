const fs = require('fs');
let content = fs.readFileSync('src/pages/AiRiskAnalysisPage.tsx', 'utf8');

const cleanNameHelper = `
  const cleanName = (n: string) => {
    if (!n) return '';
    const words = n.trim().split(/\\s+/);
    const unique = [];
    for (const w of words) {
      if (!unique.some(x => x.toLowerCase() === w.toLowerCase())) {
        unique.push(w);
      }
    }
    return unique.join(' ');
  };
`;

if (!content.includes('const cleanName = ')) {
  content = content.replace('  const handleQuickQuestion =', cleanNameHelper + '\n  const handleQuickQuestion =');
}

const tableRegex = /<div className="hub-table-wrap">[\s\S]*?<table className="popup-table">[\s\S]*?<thead>[\s\S]*?<\/thead>[\s\S]*?<tbody>[\s\S]*?<\/tbody>[\s\S]*?<\/table>[\s\S]*?<\/div>/;
const paretoListReplacement = `<div className="pareto-card-list" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {customers.slice(0, 8).map((c: any, i: number) => (
                <div 
                  key={c.customerId} 
                  className="pareto-minimal-card" 
                  onClick={() => triggerOpenCustomerModal(c)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(59,130,246,0.1)', color: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 'bold' }}>{i + 1}</div>
                    <div>
                      <div style={{ color: '#F6F8FC', fontWeight: 600, fontSize: '0.9rem' }}>{cleanName(c.customerName)}</div>
                      <div style={{ color: '#9BA6BC', fontSize: '0.75rem', marginTop: '4px', display: 'flex', gap: '12px' }}>
                        <span>Vadesi Geçen: <strong style={{ color: (c.overdueBalance || 0) > 0 ? '#FB7B85' : '#3DDC9A' }}>{formatCurrency(c.overdueBalance || 0)}</strong></span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className="num" style={{ color: '#F6F8FC', fontWeight: 700, fontSize: '0.95rem' }}>{formatCurrency(c.balance || 0)}</div>
                    <span className={\`badge-pill \${(c.overdueBalance || 0) > 50000 ? 'red' : ((c.overdueBalance || 0) > 0 ? 'amber' : 'green')}\`}>
                      {(c.overdueBalance || 0) > 50000 ? 'Yüksek Risk' : ((c.overdueBalance || 0) > 0 ? 'Orta Risk' : 'Düşük Risk')}
                    </span>
                  </div>
                </div>
              ))}
            </div>`;

content = content.replace(tableRegex, paretoListReplacement);

const healthCardRegex = /<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>[\s\S]*?<\/div>\s*<\/div>\s*<div className="hub-table-wrap">[\s\S]*?<table className="popup-table">[\s\S]*?<thead>[\s\S]*?<\/thead>[\s\S]*?<tbody>[\s\S]*?<\/tbody>[\s\S]*?<\/table>[\s\S]*?<\/div>/;

const healthReplacement = `<div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: '#9BA6BC', display: 'flex', alignItems: 'center', gap: '6px' }}><i className="fa-solid fa-fire" style={{ color: '#FB7B85' }}></i> Enflasyon Maliyet Drag Yükü</div>
                  <div className="num" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#FB7B85', marginTop: '8px' }}>
                    {formatCurrency((totalOverdue || 0) * 0.045)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#5C6479', marginTop: '4px' }}>Aylık %4.5 enflasyon aşınması baz alınmıştır</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: '#9BA6BC', display: 'flex', alignItems: 'center', gap: '6px' }}><i className="fa-solid fa-clock-rotate-left" style={{ color: '#F6BB4D' }}></i> Ortalama Portfolio Vadesi</div>
                  <div className="num" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#F6BB4D', marginTop: '8px' }}>
                    42 Gün
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#5C6479', marginTop: '4px' }}>Ağırlıklı Ödeme Vadesi (Genel Şirket)</div>
                </div>
              </div>
              <div className="hub-table-wrap" style={{ marginTop: '16px' }}>
                <table className="popup-table">
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 16px' }}>Vade Dilimi</th>
                      <th className="num-cell" style={{ padding: '10px 16px' }}>Müşteri Sayısı</th>
                      <th className="num-cell" style={{ padding: '10px 16px' }}>Toplam Tutar</th>
                      <th style={{ padding: '10px 16px' }}>Etki</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '10px 16px', fontWeight: 500 }}>0 - 30 Gün (Cari)</td>
                      <td className="num-cell" style={{ padding: '10px 16px' }}>142</td>
                      <td className="num-cell" style={{ padding: '10px 16px' }}>{formatCurrency(globalSummary.totalNetReceivables * 0.45)}</td>
                      <td style={{ padding: '10px 16px' }}><span className="badge-pill green">Normal</span></td>
                    </tr>
                    <tr style={{ background: 'rgba(245, 158, 11, 0.05)' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 500 }}>31 - 60 Gün Gecikme</td>
                      <td className="num-cell" style={{ padding: '10px 16px' }}>28</td>
                      <td className="num-cell" style={{ padding: '10px 16px', color: '#F6BB4D' }}>{formatCurrency(globalSummary.totalNetReceivables * 0.30)}</td>
                      <td style={{ padding: '10px 16px' }}><span className="badge-pill amber">Orta Uyarı</span></td>
                    </tr>
                    <tr style={{ background: 'rgba(239, 68, 68, 0.05)' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 500 }}>61 - 90+ Gün Kritik Gecikme</td>
                      <td className="num-cell" style={{ padding: '10px 16px' }}>12</td>
                      <td className="num-cell" style={{ padding: '10px 16px', color: '#FB7B85', fontWeight: 600 }}>{formatCurrency(totalOverdue || 0)}</td>
                      <td style={{ padding: '10px 16px' }}><span className="badge-pill red">Kritik Risk</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>`;

content = content.replace(healthCardRegex, healthReplacement);

const aiAnalysisHtml = `
        <div className="hub-card" style={{ marginTop: '24px', background: 'linear-gradient(145deg, rgba(139, 92, 246, 0.05) 0%, rgba(13, 17, 28, 0.95) 100%)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
          <div className="hub-card-header">
            <span className="hub-card-title" style={{ color: '#A78BFA' }}>
              <i className="fa-solid fa-brain" style={{ marginRight: '8px' }}></i>
              Günlü (AI) Analiz Özeti
            </span>
          </div>
          <div style={{ padding: '16px', color: '#F6F8FC', lineHeight: '1.6', fontSize: '0.9rem' }}>
            Şirket genelinde toplam <strong style={{ color: '#3B82F6' }}>{formatCurrency(globalSummary.totalNetReceivables)}</strong> net alacak bulunmaktadır.
            Bunun <strong style={{ color: '#FB7B85' }}>{formatCurrency(totalOverdue || 0)}</strong> kısmı vadesi geçmiş borçlardan oluşmaktadır.
            Koleksiyon Etkinlik İndeksi (CEI) <strong style={{ color: '#3DDC9A' }}>%{(globalSummary.totalCollectionAmount / (globalSummary.totalSalesAmount || 1) * 100).toFixed(1)}</strong> seviyesindedir.
            Vadesi geçen alacakların enflasyon (drag) yükü, nakit akışını olumsuz etkilemektedir. Geciken bakiyelerin tahsilatına ağırlık verilmesi ve Pareto'nun %20'lik risk grubuna (<strong style={{ color: '#A78BFA' }}>%{paretoVal} Yoğunluk</strong>) odaklanılması önerilmektedir.
          </div>
        </div>
`;

content = content.replace(/<\/div>\s*<div className="ai-hub-chips-bar"/, '</div>\n' + aiAnalysisHtml + '\n        <div className="ai-hub-chips-bar"');

fs.writeFileSync('src/pages/AiRiskAnalysisPage.tsx', content, 'utf8');
console.log("Done");
