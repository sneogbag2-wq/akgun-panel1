import React, { useState, useEffect } from 'react';
import './AiQualityPanelPage.css';
import { getAiDiagnosticsSummary, type AiDiagnosticsSummary } from '../services/aiDiagnostics';
import { runOfflineEvaluations, type AiEvaluationSummary } from '../services/aiEvaluationRunner';
import { runLiveAiEvaluation, type LiveAiEvaluationOutcome } from '../services/aiLiveEvaluation';

export default function AiQualityPanelPage() {
  const [diagnostics, setDiagnostics] = useState<AiDiagnosticsSummary | null>(null);
  const [offlineResults, setOfflineResults] = useState<AiEvaluationSummary | null>(null);
  const [liveResults, setLiveResults] = useState<LiveAiEvaluationOutcome[] | null>(null);
  const [isRunningOffline, setIsRunningOffline] = useState(false);
  const [isRunningLive, setIsRunningLive] = useState(false);

  useEffect(() => {
    // Load diagnostics on mount
    try {
      const summary = getAiDiagnosticsSummary();
      setDiagnostics(summary);
    } catch (e) {
      console.error('Failed to load diagnostics', e);
    }
  }, []);

  const handleRunOfflineTests = () => {
    setIsRunningOffline(true);
    setTimeout(() => {
      try {
        const results = runOfflineEvaluations();
        setOfflineResults(results);
      } catch (e) {
        console.error('Failed to run offline evaluations', e);
      } finally {
        setIsRunningOffline(false);
      }
    }, 500); // Simulate network/processing delay for UI feedback
  };

  const handleRunLiveTests = async () => {
    setIsRunningLive(true);
    try {
      const results = await runLiveAiEvaluation();
      setLiveResults(results);
    } catch (e) {
      console.error('Failed to run live evaluations', e);
      alert('Canlı testler çalıştırılırken bir hata oluştu. Lütfen API anahtarınızı kontrol edin.');
    } finally {
      setIsRunningLive(false);
    }
  };

  return (
    <div className="quality-panel-page">
      <div className="quality-header">
        <h1>AI-07 Kalite ve Gözlem Paneli</h1>
        <p>Yapay Zeka Karar, Yönlendirme ve Güvenlik Metrikleri İzleme Merkezi</p>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Toplam AI İsteği</h3>
          <p className="metric-value">{diagnostics?.requestCount || 0}</p>
        </div>
        <div className="metric-card">
          <h3>Ortalama Yanıt Süresi</h3>
          <p className="metric-value">{diagnostics?.averageRequestDurationMs || 0} ms</p>
        </div>
        <div className="metric-card">
          <h3>Offline Fallback Oranı</h3>
          <p className="metric-value">{((diagnostics?.fallbackRate || 0) * 100).toFixed(1)}%</p>
        </div>
        <div className="metric-card">
          <h3>Araç Kullanım Oranı</h3>
          <p className="metric-value">{((diagnostics?.toolUseRate || 0) * 100).toFixed(1)}%</p>
        </div>
      </div>

      <div className="panels-container">
        <div className="panel-section">
          <h2>
            Güvenlik ve Yönlendirme (Offline)
            <button 
              className="btn-primary" 
              onClick={handleRunOfflineTests}
              disabled={isRunningOffline}
            >
              {isRunningOffline ? 'Çalışıyor...' : 'Testleri Çalıştır'}
            </button>
          </h2>
          
          {offlineResults && (
            <div style={{ marginBottom: '16px' }}>
              <strong>Başarı Oranı:</strong> {(offlineResults.passRate * 100).toFixed(1)}% 
              ({offlineResults.passed} / {offlineResults.total} başarılı)
            </div>
          )}

          <div className="test-results-list">
            {!offlineResults && <p style={{ color: '#64748b' }}>Henüz test çalıştırılmadı.</p>}
            
            {offlineResults?.results.map((res, i) => (
              <div key={i} className={`test-result-item ${res.passed ? 'passed' : 'failed'}`}>
                <div className="result-icon">{res.passed ? '✅' : '❌'}</div>
                <div className="result-content">
                  <div className="result-id">{res.scenarioId}</div>
                  <p className="result-details">
                    Beklenen Niyet: {res.details.expectedIntent} | 
                    Tespit Edilen: {res.details.actualIntent}
                  </p>
                  {!res.passed && res.details.errors.length > 0 && (
                    <ul className="error-list">
                      {res.details.errors.map((err, j) => (
                        <li key={j}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel-section">
          <h2>
            Canlı Sağlayıcı Duman Testi (Live)
            <button 
              className="btn-primary" 
              onClick={handleRunLiveTests}
              disabled={isRunningLive}
              style={{ background: '#10b981' }}
            >
              {isRunningLive ? 'Sorgulanıyor...' : 'Canlı Test Başlat'}
            </button>
          </h2>
          
          <div className="test-results-list">
            {!liveResults && <p style={{ color: '#64748b' }}>Canlı API kullanılarak senaryolar test edilebilir.</p>}
            
            {liveResults?.map((res, i) => (
              <div key={i} className={`test-result-item ${res.passed ? 'passed' : 'failed'}`}>
                <div className="result-icon">{res.passed ? '✅' : '❌'}</div>
                <div className="result-content">
                  <div className="result-id">{res.id}</div>
                  <p className="result-details">
                    Sağlayıcı: {res.provider} {res.modelName ? `(${res.modelName})` : ''} <br/>
                    Araçlar: {res.toolCalls.join(', ') || 'Yok'}
                  </p>
                  {!res.passed && res.failure && (
                    <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px' }}>
                      {res.failure}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel-section" style={{ gridColumn: '1 / -1' }}>
          <h2>En Çok Kullanılan Araçlar</h2>
          <div className="tool-usage-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            {!diagnostics || Object.keys(diagnostics.toolCounts).length === 0 ? (
              <p style={{ color: '#64748b' }}>Kullanım verisi bulunmuyor.</p>
            ) : (
              Object.entries(diagnostics.toolCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([tool, count]) => (
                  <div key={tool} className="tool-usage-item">
                    <span className="tool-name">{tool}</span>
                    <span className="tool-count">{count}</span>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
