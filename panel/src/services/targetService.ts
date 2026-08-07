// src/services/targetService.ts
// Temsilci, SSM ve Şirket geneli için manuel sellout hedeflerini yönetir.

import { supabase } from '../lib/supabaseClient';

export interface SelloutTarget {
  id: string; // "YYYY-MM_TYPE_NAME" (e.g., "2023-10_REP_Ahmet")
  period: string; // "YYYY-MM"
  type: 'REP' | 'SSM' | 'COMPANY';
  name: string;
  openChannelTarget: number; // Liters/Kolies target for Open Channel
  closedChannelTarget: number; // Liters/Kolies target for Closed Channel
}

// Memory cache as SSOT for UI sync
let targetsCache: SelloutTarget[] = [];
let isInitialized = false;

export async function fetchTargetsFromApi(): Promise<void> {
  const { data, error } = await supabase.from('ui_sellout_targets').select('*');
  if (error) {
    throw new Error('Hedefler yüklenirken hata: ' + error.message);
  }
  
  targetsCache = (data || []).map(row => ({
    id: row.id,
    period: row.period,
    type: row.target_type as 'REP' | 'SSM' | 'COMPANY',
    name: row.name,
    openChannelTarget: row.open_channel_target,
    closedChannelTarget: row.closed_channel_target
  }));
  isInitialized = true;
}

export function getTargets(period?: string): SelloutTarget[] {
  if (!isInitialized) {
    // In strict SSOT we should wait for init, but for synchronous UI calls
    // we return whatever we have. App initialization should call fetchTargetsFromApi.
  }
  if (period) {
    return targetsCache.filter(t => t.period === period);
  }
  return [...targetsCache];
}

export async function saveTarget(target: SelloutTarget): Promise<void> {
  const { error } = await supabase.from('ui_sellout_targets').upsert({
    id: target.id,
    period: target.period,
    target_type: target.type,
    name: target.name,
    open_channel_target: target.openChannelTarget,
    closed_channel_target: target.closedChannelTarget
  });
  
  if (error) {
    throw new Error('Hedef kaydedilirken hata: ' + error.message);
  }
  
  await fetchTargetsFromApi(); // SSOT update
}

export async function saveTargets(newTargets: SelloutTarget[]): Promise<void> {
  if (!newTargets.length) return;
  
  const payload = newTargets.map(t => ({
    id: t.id,
    period: t.period,
    target_type: t.type,
    name: t.name,
    open_channel_target: t.openChannelTarget,
    closed_channel_target: t.closedChannelTarget
  }));
  
  const { error } = await supabase.from('ui_sellout_targets').upsert(payload);
  if (error) {
    throw new Error('Hedefler toplu kaydedilirken hata: ' + error.message);
  }
  
  await fetchTargetsFromApi(); // SSOT update
}

export async function deleteTarget(id: string): Promise<void> {
  const { error } = await supabase.from('ui_sellout_targets').delete().eq('id', id);
  if (error) {
    throw new Error('Hedef silinirken hata: ' + error.message);
  }
  
  await fetchTargetsFromApi(); // SSOT update
}

// Helpers
export function generateTargetId(period: string, type: 'REP' | 'SSM' | 'COMPANY', name: string): string {
  return `${period}_${type}_${name}`;
}
