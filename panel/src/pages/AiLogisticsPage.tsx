import React, { useState, useEffect, useMemo } from 'react';
import { 
  getShipmentTrackingDataSync,
  getSelloutTrackingDataSync,
  subscribeDataChange
} from '../services/customerService';
import { formatCurrency } from '../utils/formatters';
import { MascotAvatar } from '../components/ai/MascotAvatar';
import './AiAnalyticsHubPage.css';

export default function AiLogisticsPage() {
  const [dataVersion, setDataVersion] = useState(0);

  const handleQuickQuestion = (promptText: string) => {
    window.dispatchEvent(new CustomEvent('open-ai-chat', { detail: { prompt: promptText } }));
  };

  useEffect(() => {
    return subscribeDataChange(() => {
      setDataVersion(prev => prev + 1);
    });
  }, []);

  const shipmentData = useMemo(() => getShipmentTrackingDataSync(''), [dataVersion]);
  const selloutData = useMemo(() => getSelloutTrackingDataSync(''), [dataVersion]);

  return (
    <div className="ai-hub-container">
      <div className="ai-hub-header">
        <div className="ai-hub-title-group">
          <div className="ai-hub-mascot-box">
            <MascotAvatar size="small" />
          </div>
          <div className="ai-hub-title-text">
            <h1>
              Sevkiyat & Lojistik Takip
              <span className="ai-hub-badge">
                <i className="fa-solid fa-circle" style={{ fontSize: '8px' }}></i> CFO AI Aktif
              </span>
            </h1>
            <div className="ai-hub-subtitle">Sipariş Gönderimleri ve Sell-Out Tüketim Analizi</div>
          </div>
        </div>
      </div>

      <div className="ai-hub-tab-content" style={{ marginTop: '24px' }}>
        <div className="grid-two-col">
          <div className="hub-card">
            <div className="hub-card-header">
              <span className="hub-card-title">
                <i className="fa-solid fa-truck"></i> Sevkiyat & Teslimat Takip Özeti
              </span>
              <span className="badge-pill green">{(shipmentData.shipments || []).length} Belge</span>
            </div>
            <div className="hub-table-wrap">
              <table className="popup-table">
                <thead>
                  <tr>
                    <th>Belge / Sipariş No</th>
                    <th>Müşteri Unvanı</th>
                    <th>Tarih</th>
                    <th className="num-cell">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {(shipmentData.shipments || []).slice(0, 10).map((s: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ fontFamily: 'monospace', color: '#3B82F6' }}>{s.belgeNo || s.siparisNo || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{s.customerName || 'Müşteri'}</td>
                      <td>{s.date || 'Veri Yok'}</td>
                      <td className="num-cell">{formatCurrency(s.amount || 0)}</td>
                    </tr>
                  ))}
                  {(!shipmentData.shipments || shipmentData.shipments.length === 0) && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: '#9BA6BC' }}>
                        Görüntülenecek sevkiyat belgesi bulunmuyor.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="hub-card">
            <div className="hub-card-header">
              <span className="hub-card-title">
                <i className="fa-solid fa-boxes-stacked"></i> Sell-Out & Distribütör Tüketim Analizi
              </span>
              <span className="badge-pill purple">Canlı Veri</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#9BA6BC', margin: 0 }}>
              Saha tüketim ve son nokta distribütör çıkış analizleri.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Toplam Sell-Out Hacmi:</span>
                <strong style={{ color: '#3DDC9A' }}>
                  {selloutData.stats.totalLiters > 0 ? `${selloutData.stats.totalLiters.toLocaleString('tr-TR')} Litre` : 'Veri Yok'}
                </strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Sell-Out Net Tutarı:</span>
                <strong style={{ color: '#F6BB4D' }}>
                  {selloutData.stats.totalNetAmount > 0 ? formatCurrency(selloutData.stats.totalNetAmount) : 'Veri Yok'}
                </strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Aktif Distribütör Sayısı:</span>
                <strong style={{ color: '#9BA6BC' }}>{selloutData.stats.customerCount}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
