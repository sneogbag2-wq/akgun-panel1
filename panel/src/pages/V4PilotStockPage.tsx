import React, { useState, useEffect } from 'react';
import { fetchV4Api } from '../services/apiClient';
import { Package, AlertTriangle, RefreshCw, UploadCloud } from 'lucide-react';

export default function V4PilotStockPage() {
  const [stockData, setStockData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadV4Stock = async () => {
    setLoading(true);
    setError('');
    try {
      // Doğrudan V4 Backend'ine bağlanıyoruz. Hesaplama YOK! Sadece veri gösterimi.
      const data = await fetchV4Api('/current-stock/variants');
      setStockData(data);
    } catch (err: any) {
      setError(err.message || 'Stok verisi çekilemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadV4Stock();
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'Inter, sans-serif' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Package size={28} /> V4 Pilot Modülü: Merkezden Yönetilen Stok
        </h1>
        <p style={{ color: '#64748b' }}>
          Bu arayüz hiçbir matematiksel hesaplama yapmaz. Tüm veriler, V4 Anayasası'na uygun olarak doğrudan Backend'den (Paket 06) çekilmektedir.
        </p>
      </header>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button 
          onClick={loadV4Stock}
          disabled={loading}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white', 
            borderRadius: '0.375rem', border: 'none', cursor: 'pointer', fontWeight: 500
          }}
        >
          <RefreshCw size={18} className={loading ? "spin" : ""} /> Yenile
        </button>
        <button 
          style={{ 
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.5rem 1rem', backgroundColor: '#10b981', color: 'white', 
            borderRadius: '0.375rem', border: 'none', cursor: 'pointer', fontWeight: 500
          }}
          onClick={() => alert("Dosya Yükleme (Paket 01) endpoint'ine post edilecek.")}
        >
          <UploadCloud size={18} /> Excel Yükle (Backend'e Gönder)
        </button>
      </div>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '0.375rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={20} /> {error}
        </div>
      )}

      <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ backgroundColor: '#f8fafc', color: '#475569', fontSize: '0.875rem' }}>
            <tr>
              <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Ürün Kodu (SKU)</th>
              <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Miktar (Quantity)</th>
              <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Hacim (Litre)</th>
              <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Tükenme Günü</th>
              <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Statü</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Veriler Backend'den Yükleniyor...</td></tr>
            ) : stockData.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Stok verisi bulunamadı. Lütfen Backend'e veri yükleyin.</td></tr>
            ) : (
              stockData.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{item.product_sku}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{item.quantity}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#0369a1' }}>{item.litres?.toFixed(2)} L</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold' }}>{item.days_until_stockout || 'N/A'} Gün</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{ 
                      padding: '0.25rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                      backgroundColor: item.status === 'STOCKOUT' ? '#fee2e2' : item.status === 'CRITICAL' ? '#fef3c7' : '#dcfce3',
                      color: item.status === 'STOCKOUT' ? '#991b1b' : item.status === 'CRITICAL' ? '#92400e' : '#166534'
                    }}>
                      {item.status || 'OK'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
