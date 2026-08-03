const fs = require('fs');
let content = fs.readFileSync('src/pages/AiLogisticsPage.tsx', 'utf8');

// The multi_replace put the AI block at the top accidentally.
// Let's remove it if it exists at the top.
const badBlockRegex = /<div className="hub-card" style=\{\{ marginTop: '24px', background: 'linear-gradient[\s\S]*?<\/div>\s*<\/div>\s*<div className="ai-hub-chips-bar"/;
if (badBlockRegex.test(content)) {
    content = content.replace(badBlockRegex, '<div className="ai-hub-tab-content"');
}

const aiAnalysisHtml = `
      <div className="hub-card" style={{ marginTop: '24px', background: 'linear-gradient(145deg, rgba(139, 92, 246, 0.05) 0%, rgba(13, 17, 28, 0.95) 100%)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
        <div className="hub-card-header">
          <span className="hub-card-title" style={{ color: '#A78BFA' }}>
            <i className="fa-solid fa-brain" style={{ marginRight: '8px' }}></i>
            Günlü (AI) Lojistik Analizi
          </span>
        </div>
        <div style={{ padding: '16px', color: '#F6F8FC', lineHeight: '1.6', fontSize: '0.9rem' }}>
          Toplam <strong>{totalLiters.toLocaleString('tr-TR')} Litre</strong> sevkiyat hedeflenen sürelerde gerçekleşmektedir. 
          Bölgesel dağılımda ağırlıklı olarak ana bayiler üzerinden sell-out yapılmıştır. Lojistik ve operasyonel darboğaz tespit edilmemiş olup, sipariş/teslimat süreçleri sağlıklı görünmektedir.
        </div>
      </div>
`;

// Insert it properly at the end before ai-hub-chips-bar
content = content.replace(/<\/div>\s*<\/div>\s*<div className="ai-hub-chips-bar"/, '</div>\n      </div>\n' + aiAnalysisHtml + '\n      <div className="ai-hub-chips-bar"');

fs.writeFileSync('src/pages/AiLogisticsPage.tsx', content, 'utf8');
