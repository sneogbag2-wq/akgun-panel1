import React, { useState, useEffect } from 'react';
import { getCapabilities, changeFeatureStatus, FeatureCapability } from '../services/cutoverShadowService';
import { fetchApi } from '../lib/apiClient';

export function CutoverDashboardPage() {
  const [capabilities, setCapabilities] = useState<FeatureCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCap, setSelectedCap] = useState<string | null>(null);
  const [targetStatus, setTargetStatus] = useState<string>('SHADOW');
  const [actorId, setActorId] = useState<string>('admin_user');
  const [reason, setReason] = useState<string>('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [discrepancies, setDiscrepancies] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const caps = await getCapabilities();
      setCapabilities(caps);

      // Fetch logs
      const res = (await fetchApi('/engine/advanced/cutover-logs')) as { data: any[] };
      setDiscrepancies(res.data || []);
    } catch (err: any) {
      console.error("Cutover dashboard error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCap || !reason.trim()) {
      setActionMessage({ type: 'error', text: 'Lütfen tüm alanları (Özellik, Neden, Kullanıcı) doldurun.' });
      return;
    }

    const success = await changeFeatureStatus(selectedCap, targetStatus, actorId, reason);
    if (success) {
      setActionMessage({ type: 'success', text: `${selectedCap} başarıyla ${targetStatus} durumuna alındı ve Four-Eyes denetimine işlendi.` });
      setSelectedCap(null);
      setReason('');
      loadData();
    } else {
      setActionMessage({ type: 'error', text: 'Status değişimi başarısız oldu.' });
    }
  };

  const getBadgeColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'SHADOW': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'FROZEN': return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      case 'V2_ONLY': return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            🛡️ Cutover Control Plane (Geçiş Yönetimi)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Paket 15: Modül bazlı geçiş bayrakları, Four-Eyes yetkili denetimi ve Shadow Mode farklılık takibi.
          </p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm font-medium rounded-lg transition-colors border border-slate-700"
        >
          🔄 Yenile
        </button>
      </div>

      {actionMessage && (
        <div className={`p-4 rounded-lg border text-sm flex items-center justify-between ${
          actionMessage.type === 'success' ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-rose-950/40 border-rose-800 text-rose-300'
        }`}>
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 font-medium">Toplam Özellik Bayrağı</div>
          <div className="text-2xl font-bold mt-1 text-white">{capabilities.length}</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 font-medium">Gölge Modunda (Shadow)</div>
          <div className="text-2xl font-bold mt-1 text-amber-400">
            {capabilities.filter(c => c.status === 'SHADOW').length}
          </div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 font-medium">Dondurulmuş (Write Freeze)</div>
          <div className="text-2xl font-bold mt-1 text-rose-400">
            {capabilities.filter(c => c.status === 'FROZEN').length}
          </div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 font-medium">Sadece V2 (V2_ONLY)</div>
          <div className="text-2xl font-bold mt-1 text-indigo-400">
            {capabilities.filter(c => c.status === 'V2_ONLY').length}
          </div>
        </div>
      </div>

      {/* Main Grid & Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Capability Cards */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-white">Modül Yetenek Durumları</h2>
          {loading ? (
            <div className="p-8 text-center text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
              Yükleniyor...
            </div>
          ) : capabilities.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
              Kayıtlı özellik bulunamadı.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {capabilities.map((cap) => (
                <div key={cap.feature_key} className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-semibold text-slate-200">{cap.feature_key}</span>
                      <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${getBadgeColor(cap.status)}`}>
                        {cap.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Son Güncelleme: {cap.updated_at ? new Date(cap.updated_at).toLocaleString('tr-TR') : '-'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedCap(cap.feature_key);
                      setTargetStatus(cap.status === 'SHADOW' ? 'FROZEN' : 'SHADOW');
                    }}
                    className="w-full text-xs font-medium py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                  >
                    ⚙️ Durumu Değiştir (Four-Eyes)
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Change Form Modal / Box */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 h-fit space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            🔐 Four-Eyes Durum Değişikliği
          </h2>
          <form onSubmit={handleStatusChange} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Seçili Modül/Özellik</label>
              <select
                value={selectedCap || ''}
                onChange={(e) => setSelectedCap(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">-- Özellik Seçin --</option>
                {capabilities.map(c => (
                  <option key={c.feature_key} value={c.feature_key}>{c.feature_key} ({c.status})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Yeni Hedef Durum</label>
              <select
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="ACTIVE">ACTIVE (Eski Sistem Etkin)</option>
                <option value="SHADOW">SHADOW (Gölge Karşılaştırma Modu)</option>
                <option value="FROZEN">FROZEN (Write Freeze - Eski Yazma Donduruldu)</option>
                <option value="V2_ONLY">V2_ONLY (Tamamen Supabase)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Onaylayan Kullanıcı (Actor ID)</label>
              <input
                type="text"
                value={actorId}
                onChange={(e) => setActorId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Değişiklik Gerekçesi (Audit Reason)</label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Geçiş nedeni, bilet no veya onay gerekçesi..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={!selectedCap}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
            >
              Onayla ve Güncelle
            </button>
          </form>
        </div>
      </div>

      {/* Discrepancy Log Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          🚨 Gölge Modu (Shadow) Uyuşmazlık Kayıtları (`cut_transition_log`)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3">Tarih</th>
                <th className="p-3">Sync Batch ID</th>
                <th className="p-3">Eski Sistem Ref</th>
                <th className="p-3">Yeni Sistem Ref</th>
                <th className="p-3">Durum</th>
                <th className="p-3">Farklılık Detayı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {discrepancies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-500">
                    Henüz herhangi bir uyuşmazlık (discrepancy) kaydedilmedi. Sistemler eşleşiyor.
                  </td>
                </tr>
              ) : (
                discrepancies.map((d: any) => (
                  <tr key={d.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 whitespace-nowrap">{new Date(d.processed_at).toLocaleString('tr-TR')}</td>
                    <td className="p-3 font-mono">{d.sync_batch_id?.slice(0, 8)}...</td>
                    <td className="p-3 font-mono text-amber-300">{d.legacy_system_ref}</td>
                    <td className="p-3 font-mono text-indigo-300">{d.new_system_ref}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        {d.sync_status}
                      </span>
                    </td>
                    <td className="p-3 max-w-xs truncate font-mono text-slate-400">
                      {JSON.stringify(d.discrepancy_details)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
