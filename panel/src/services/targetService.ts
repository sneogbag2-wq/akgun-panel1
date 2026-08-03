// src/services/targetService.ts
// Temsilci, SSM ve Şirket geneli için manuel sellout hedeflerini yönetir.

export interface SelloutTarget {
  id: string; // "YYYY-MM_TYPE_NAME" (e.g., "2023-10_REP_Ahmet")
  period: string; // "YYYY-MM"
  type: 'REP' | 'SSM' | 'COMPANY';
  name: string;
  openChannelTarget: number; // Liters/Kolies target for Open Channel
  closedChannelTarget: number; // Liters/Kolies target for Closed Channel
}

const STORAGE_KEY = 'akgun_sellout_targets';

export function getTargets(period?: string): SelloutTarget[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    let targets: SelloutTarget[] = JSON.parse(data);
    if (period) {
      targets = targets.filter(t => t.period === period);
    }
    return targets;
  } catch (error) {
    console.error("Hedefler yüklenirken hata:", error);
    return [];
  }
}

export function saveTarget(target: SelloutTarget): void {
  try {
    const targets = getTargets();
    const index = targets.findIndex(t => t.id === target.id);
    if (index >= 0) {
      targets[index] = target;
    } else {
      targets.push(target);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(targets));
  } catch (error) {
    console.error("Hedef kaydedilirken hata:", error);
  }
}

export function saveTargets(newTargets: SelloutTarget[]): void {
  try {
    const targets = getTargets();
    newTargets.forEach(target => {
      const index = targets.findIndex(t => t.id === target.id);
      if (index >= 0) {
        targets[index] = target;
      } else {
        targets.push(target);
      }
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(targets));
  } catch (error) {
    console.error("Hedefler toplu kaydedilirken hata:", error);
  }
}

export function deleteTarget(id: string): void {
  try {
    const targets = getTargets();
    const filtered = targets.filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Hedef silinirken hata:", error);
  }
}

// Helpers
export function generateTargetId(period: string, type: 'REP' | 'SSM' | 'COMPANY', name: string): string {
  return `${period}_${type}_${name}`;
}
