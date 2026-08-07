import './SuggestedQuestions.css';

interface SuggestionItem {
  icon: string;
  label: string;
  query: string;
  category: string;
  hint?: string;
}

const SUGGESTIONS: SuggestionItem[] = [
  { icon: '📊', label: 'En Borçlu Müşteriler', query: 'En yüksek borcu olan 10 müşteriyi listele', category: 'Risk', hint: 'En yüksek bakiye sahibi 10 cari' },
  { icon: '📈', label: 'Genel Finansal Özet', query: 'Genel finansal durum ve alacak özeti ver', category: 'Özet', hint: 'Toplam borç, tahsilat & vade' },
  { icon: '⏱️', label: 'Vade Yaşlandırma', query: 'Vade yaşlandırma dağılımını göster', category: 'Vade', hint: '0-30, 31-60, 61-90+ gün kırılımı' },
  { icon: '💵', label: 'Tahsilat Türleri', query: 'Tahsilat türlerinin tutar bazlı dağılımı nedir?', category: 'Tahsilat', hint: 'Nakit, Kredi Kartı, Çek/Senet' },
  { icon: '🔍', label: 'Açık Faturalar', query: 'Toplam kaç adet açık fatura var ve bugün gelen tahsilat ne kadar?', category: 'Fatura', hint: 'Güncel fatura & günlük tahsilatlar' },
  { icon: '🚨', label: 'Riskli Cariler', query: '30.000 TL üzeri açık riski olan kritik müşterileri listele', category: 'Kritik', hint: 'Bakiye ve vade aşımı yüksek cariler' }
];

interface SuggestedQuestionsProps {
  onSelectQuestion: (query: string) => void;
}

export function SuggestedQuestions({ onSelectQuestion }: SuggestedQuestionsProps) {
  return (
    <div className="suggested-questions-container">
      <div className="suggested-header">
        <span className="suggested-sparkle">✨</span>
        <span className="suggested-title">ÖNERİLEN ANALİZLER VE SORULAR</span>
        <span className="suggested-badge">Hızlı Sorular</span>
      </div>
      <div className="suggested-chips-grid">
        {SUGGESTIONS.map((item, idx) => (
          <button
            key={idx}
            type="button"
            className={`suggested-chip-card category-${item.category.toLowerCase()}`}
            onClick={() => onSelectQuestion(item.query)}
            title={item.hint || item.query}
          >
            <div className="chip-icon-box">{item.icon}</div>
            <div className="chip-text-content">
              <span className="chip-label">{item.label}</span>
              <span className="chip-hint">{item.hint}</span>
            </div>
            <div className="chip-arrow-icon">↗</div>
          </button>
        ))}
      </div>
    </div>
  );
}
