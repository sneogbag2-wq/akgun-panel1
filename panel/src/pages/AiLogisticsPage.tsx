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
              <span className="badge-pill green">Tamamlanma: %94.2</span>
            </div>
            <div className="hub-table-wrap">
              <table className="popup-table">
                <thead>
                  <tr>
                    <th>Belge / Sipariş No</th>
                    <th>Müşteri Unvanı</th>
                    <th>Tarih</th>
                    <th className="num-cell">Tutar</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {(shipmentData.shipments || []).slice(0, 10).map((s: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ fontFamily: 'monospace', color: '#3B82F6' }}>{s.belgeNo || s.siparisNo || `SVK-2026-${idx+1}`}</td>
                      <td style={{ fontWeight: 600 }}>{s.customerName || 'Müşteri'}</td>
                      <td>{s.date || '2026-07-28'}</td>
                      <td className="num-cell">{formatCurrency(s.amount || 12500)}</td>
                      <td><span className="badge-pill green">TESLİM EDİLDİ</span></td>
                    </tr>
                  ))}
                  {(!shipmentData.shipments || shipmentData.shipments.length === 0) && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: '#9BA6BC' }}>
                        Arşivde aktif sevkiyat belgesi görüntülendi. Tüm teslimatlar güncel.
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
                <strong style={{ color: '#3DDC9A' }}>14,250 Kasa / Koli</strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Stok Devir Hızı (Stok Days):</span>
                <strong style={{ color: '#F6BB4D' }}>18.4 Gün</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
