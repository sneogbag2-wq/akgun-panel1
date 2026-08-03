import React, { useState, useEffect } from 'react';
import { SelloutTarget, getTargets, saveTargets, generateTargetId } from '../../services/targetService';
import { getAllCustomersForReportingSync, getRawSelloutDataSync } from '../../services/customerService';
import { ModalWrapper } from '../common/ModalWrapper';
import './TargetSettingsModal.css';

interface TargetSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TargetSettingsModal: React.FC<TargetSettingsModalProps> = ({ isOpen, onClose }) => {
  const [period, setPeriod] = useState<string>(() => {
    try {
      const selloutData = getRawSelloutDataSync();
      if (selloutData && selloutData.length > 0) {
        const dates = selloutData.map((s: any) => s.date).filter(Boolean).sort();
        if (dates.length > 0) {
          const latestDate = dates[dates.length - 1];
          if (latestDate.length >= 7) return latestDate.slice(0, 7);
        }
      }
    } catch (e) {}
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [targets, setTargets] = useState<SelloutTarget[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, period]);

  const loadData = () => {
    const loadedTargets = getTargets(period);
    const customers = getAllCustomersForReportingSync();
    
    const reps = new Set<string>();
    customers.forEach(c => {
      if (c.salesRepName) reps.add(c.salesRepName);
    });

    const combined = Array.from(reps).sort().map(rep => {
      const existing = loadedTargets.find(t => t.type === 'REP' && t.name === rep);
      if (existing) return existing;
      return {
        id: generateTargetId(period, 'REP', rep),
        period,
        type: 'REP' as const,
        name: rep,
        openChannelTarget: 0,
        closedChannelTarget: 0
      };
    });

    setTargets(combined);
  };

  const handleTargetChange = (index: number, channel: 'openChannelTarget' | 'closedChannelTarget', value: string) => {
    const newTargets = [...targets];
    newTargets[index] = {
      ...newTargets[index],
      [channel]: parseFloat(value) || 0
    };
    setTargets(newTargets);
  };

  const handleSave = () => {
    saveTargets(targets);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Sellout Hedef Ayarları (Litre)">
      <div className="target-modal-wrap">
        <div className="target-modal-period-box">
          <label>Hedef Dönemi</label>
          <input 
            type="month" 
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="target-modal-date-input"
          />
        </div>

        <div className="target-modal-table-wrap">
          <table className="target-modal-table">
            <thead>
              <tr>
                <th>Temsilci Adı</th>
                <th style={{ textAlign: 'right' }}>Açık Kanal Hedef (L)</th>
                <th style={{ textAlign: 'right' }}>Kapalı Kanal Hedef (L)</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t, idx) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.name}</td>
                  <td>
                    <input 
                      type="number"
                      value={t.openChannelTarget || ''}
                      onChange={(e) => handleTargetChange(idx, 'openChannelTarget', e.target.value)}
                      placeholder="0"
                      className="target-modal-input"
                    />
                  </td>
                  <td>
                    <input 
                      type="number"
                      value={t.closedChannelTarget || ''}
                      onChange={(e) => handleTargetChange(idx, 'closedChannelTarget', e.target.value)}
                      placeholder="0"
                      className="target-modal-input"
                    />
                  </td>
                </tr>
              ))}
              {targets.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '32px', color: '#5C6479' }}>
                    Sistemde aktif temsilci bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="target-modal-footer">
          <button onClick={onClose} className="target-btn-cancel">
            İptal
          </button>
          <button onClick={handleSave} className="target-btn-save">
            <i className="fa-solid fa-floppy-disk" style={{ marginRight: '6px' }}></i>
            Hedefleri Kaydet
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};
