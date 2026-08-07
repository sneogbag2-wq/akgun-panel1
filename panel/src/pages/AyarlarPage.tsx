import React, { useState, useEffect } from 'react';
import { Settings, Shield, Activity, Save, Trash2, Download, Bot } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  isAiDiagnosticsOptedIn,
  setAiDiagnosticsOptIn,
  getAiDiagnosticsSummary,
  clearAiDiagnostics,
  downloadAiDiagnostics,
  type AiDiagnosticsSummary
} from '../services/aiDiagnostics';
import {
  listDynamicSubagents,
  upsertDynamicSubagent,
  deleteDynamicSubagent
} from '../services/aiAgentRegistry';
import type { DynamicSubagent } from '../types/ai';
import './AyarlarPage.css';

export default function AyarlarPage() {
  const [activeTab, setActiveTab] = useState<'telemetri' | 'ajanlar'>('telemetri');
  
  // Telemetry State
  const [optIn, setOptIn] = useState<boolean>(false);
  const [stats, setStats] = useState<AiDiagnosticsSummary | null>(null);

  // Subagents State
  const [agents, setAgents] = useState<DynamicSubagent[]>([]);
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrompt, setFormPrompt] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setOptIn(isAiDiagnosticsOptedIn());
    loadStats();
    loadAgents();
  }, []);

  const loadStats = () => {
    setStats(getAiDiagnosticsSummary());
  };

  const loadAgents = () => {
    setAgents(listDynamicSubagents());
  };

  const handleOptInChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setAiDiagnosticsOptIn(val);
    setOptIn(val);
  };

  const handleClearStats = () => {
    if (window.confirm('Tüm AI Telemetri verilerini silmek istediğinize emin misiniz?')) {
      clearAiDiagnostics();
      loadStats();
    }
  };

  const handleAddAgent = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      upsertDynamicSubagent({
        name: formName,
        role: formRole,
        description: formDesc,
        systemPrompt: formPrompt
      });
      loadAgents();
      setFormName('');
      setFormRole('');
      setFormDesc('');
      setFormPrompt('');
    } catch (err: any) {
      setFormError(err.message || 'Bilinmeyen bir hata oluştu.');
    }
  };

  const handleDeleteAgent = (name: string) => {
    if (window.confirm(`"${name}" ajanını silmek istediğinize emin misiniz?`)) {
      deleteDynamicSubagent(name);
      loadAgents();
    }
  };

  const chartData = stats
    ? Object.entries(stats.toolCounts).map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
    : [];

  return (
    <div className="ayarlar-page">
      <header className="ayarlar-header">
        <h1 className="ayarlar-title">
          <Settings size={28} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
          Sistem Ayarları
        </h1>
        <p className="ayarlar-subtitle">AI Telemetri verilerini izleyin ve özel alt-ajanlarınızı yönetin.</p>
      </header>

      <div className="ayarlar-tabs">
        <button
          className={`ayarlar-tab-btn ${activeTab === 'telemetri' ? 'active' : ''}`}
          onClick={() => setActiveTab('telemetri')}
        >
          <Activity size={16} style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
          AI Telemetri Paneli
        </button>
        <button
          className={`ayarlar-tab-btn ${activeTab === 'ajanlar' ? 'active' : ''}`}
          onClick={() => setActiveTab('ajanlar')}
        >
          <Bot size={16} style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
          Alt-Ajan Yönetimi
        </button>
      </div>

      {activeTab === 'telemetri' && (
        <div className="ayarlar-card">
          <div className="ayarlar-card-header">
            <h2 className="ayarlar-card-title">
              <Shield size={20} color="#8A6D1F" />
              Veri Paylaşımı & İzinler
            </h2>
          </div>

          <label className="telemetry-toggle">
            <div className="toggle-switch">
              <input type="checkbox" checked={optIn} onChange={handleOptInChange} />
              <span className="toggle-slider"></span>
            </div>
            <div className="toggle-info">
              <div className="toggle-info-title">Anonim Kullanım Verilerini Paylaş (Opt-In)</div>
              <div className="toggle-info-desc">
                Bu ayar açık olduğunda, AI asistanın araç kullanım sıklığı ve hata oranları KVKK/GDPR uyumlu olarak, PII (Kişisel Tanımlanabilir Bilgi) içermeden anonim olarak toplanır.
              </div>
            </div>
          </label>

          {stats && (
            <>
              <div className="ayarlar-card-header" style={{ marginTop: '32px' }}>
                <h2 className="ayarlar-card-title">
                  <Activity size={20} color="#8A6D1F" />
                  Performans ve Kullanım Özeti
                </h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-secondary" onClick={downloadAiDiagnostics}>
                    <Download size={16} /> JSON İndir
                  </button>
                  <button className="btn-danger" onClick={handleClearStats}>
                    <Trash2 size={16} /> Temizle
                  </button>
                </div>
              </div>

              <div className="stats-grid">
                <div className="stat-box">
                  <div className="stat-label">Toplam İstek</div>
                  <div className="stat-value">{stats.requestCount}</div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">Ort. Yanıt Süresi</div>
                  <div className="stat-value">{stats.averageRequestDurationMs} ms</div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">Fallback Oranı</div>
                  <div className="stat-value">{(stats.fallbackRate * 100).toFixed(1)}%</div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">Araç Kullanım Oranı</div>
                  <div className="stat-value">{(stats.toolUseRate * 100).toFixed(1)}%</div>
                </div>
              </div>

              {chartData.length > 0 && (
                <div className="chart-container">
                  <h3 style={{ fontSize: '1rem', color: '#334155', marginBottom: '16px' }}>En Sık Kullanılan Araçlar (Top)</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                      <Tooltip
                        cursor={{ fill: '#F1F5F9' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                      />
                      <Bar dataKey="count" fill="#8A6D1F" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'ajanlar' && (
        <div className="ayarlar-card">
          <div className="ayarlar-card-header">
            <h2 className="ayarlar-card-title">
              <Bot size={20} color="#8A6D1F" />
              Alt-Ajanlar (Subagents)
            </h2>
          </div>

          <form className="ayarlar-form" onSubmit={handleAddAgent}>
            <h3 style={{ fontSize: '1rem', color: '#1E293B', marginBottom: '8px' }}>Yeni Özel Ajan Ekle</h3>
            {formError && <div style={{ color: '#DC2626', fontSize: '0.85rem', marginBottom: '8px' }}>{formError}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Ajan İsmi (ID)</label>
                <input
                  type="text"
                  placeholder="örn. customAnalyzerAgent"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Rol (Role)</label>
                <input
                  type="text"
                  placeholder="örn. Gelişmiş Risk Analizörü"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label>Kısa Açıklama (Description)</label>
              <input
                type="text"
                placeholder="Ajanın yeteneklerini anlatan kısa bir açıklama..."
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Sistem Komutu (System Prompt)</label>
              <textarea
                placeholder="Sen bir Gelişmiş Risk Analizörüsün..."
                value={formPrompt}
                onChange={(e) => setFormPrompt(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button type="submit" className="btn-primary">
                <Save size={16} /> Ajanı Kaydet / Güncelle
              </button>
            </div>
          </form>

          <div className="agents-grid">
            {agents.map((agent) => (
              <div key={agent.name} className="agent-card">
                <div className="agent-card-header">
                  <div className="agent-name">{agent.name}</div>
                  <span className={`agent-badge ${agent.isBuiltIn ? 'builtin' : 'custom'}`}>
                    {agent.isBuiltIn ? 'Sistem' : 'Özel'}
                  </span>
                </div>
                <div className="agent-role">{agent.role}</div>
                <div className="agent-desc">{agent.description}</div>
                <div className="agent-footer">
                  {!agent.isBuiltIn && (
                    <button className="btn-danger" onClick={() => handleDeleteAgent(agent.name)}>
                      <Trash2 size={16} /> Sil
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
