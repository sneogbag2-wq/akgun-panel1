import React, { useState, useEffect } from 'react';
import { fetchApi } from '../lib/apiClient';
import { Play, RotateCcw, AlertTriangle, Activity } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

export default function AiScenarioPage() {
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeScenario, setActiveScenario] = useState<any>(null);

  useEffect(() => {
    loadScenarios();
  }, []);

  const loadScenarios = async () => {
    try {
      setLoading(true);
      // Fetch available scenarios from the registry
      // Note: We might not have a direct endpoint for listing scenarios if we only have /metric-registry
      // For now, let's just fetch metric registry to see what we can do, or mock standard scenarios
      const res = await fetchApi('/advanced/metric-registry');
      setScenarios(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const runStressTest = async (scenarioId: string) => {
    // This is a UI placeholder that would call a real backend stress test endpoint
    // For now we will mock the visual execution
    setActiveScenario({ id: scenarioId, status: 'RUNNING' });
    setTimeout(() => {
      setActiveScenario({
        id: scenarioId,
        status: 'COMPLETED',
        results: {
          impactRisk: 'Yüksek',
          revenueLoss: 154000,
          details: 'Eğer X ürününde %10 indirim uygulanırsa kar marjı 4 puan düşecek.'
        }
      });
    }, 1500);
  };

  return (
    <div className="page-container" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={24} color="#3B82F6" />
          Senaryo Yönetimi ve Stres Testleri (SCN & FAN)
        </h1>
        <p style={{ color: '#64748B', marginTop: '4px' }}>
          Finansal analiz ve yapay zeka (AIENG) destekli "What-If" senaryo simülasyonları.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>Mevcut Modeller</h2>
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>Yükleniyor...</div>
          ) : scenarios.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {scenarios.map((scn: any, idx: number) => (
                <li key={idx} style={{ padding: '12px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ display: 'block', color: '#334155' }}>{scn.metric_code || scn.name || 'Bilinmeyen Senaryo'}</strong>
                    <span style={{ fontSize: '0.85rem', color: '#64748B' }}>{scn.description || 'Açıklama yok'}</span>
                  </div>
                  <button 
                    onClick={() => runStressTest(scn.metric_code || idx)}
                    style={{ background: '#EFF6FF', color: '#3B82F6', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Play size={16} /> Test Et
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>
              Hiç senaryo veya metrik bulunamadı.
            </div>
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>Simülasyon Sonuçları</h2>
          {!activeScenario ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#94A3B8' }}>
              <RotateCcw size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <p>Bir stres testi başlatın.</p>
            </div>
          ) : activeScenario.status === 'RUNNING' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#3B82F6' }}>
              <div style={{ width: '40px', height: '40px', border: '4px solid #EFF6FF', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <p style={{ marginTop: '16px', fontWeight: 500 }}>Hesaplanıyor...</p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px', background: '#FEF2F2', borderRadius: '8px', border: '1px solid #FCA5A5', marginBottom: '20px' }}>
                <AlertTriangle color="#EF4444" size={24} style={{ flexShrink: 0 }} />
                <div>
                  <h4 style={{ margin: '0 0 4px 0', color: '#991B1B', fontSize: '0.95rem' }}>Risk Değerlendirmesi: {activeScenario.results.impactRisk}</h4>
                  <p style={{ margin: 0, color: '#B91C1C', fontSize: '0.9rem' }}>{activeScenario.results.details}</p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <span style={{ display: 'block', color: '#64748B', fontSize: '0.85rem', marginBottom: '4px' }}>Tahmini Gelir Kaybı / Maliyet</span>
                  <strong style={{ fontSize: '1.5rem', color: '#0F172A' }}>{formatCurrency(activeScenario.results.revenueLoss)}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
