import { fetchApi } from '../lib/apiClient';

export interface FeatureCapability {
  feature_key: string;
  status: 'ACTIVE' | 'SHADOW' | 'FROZEN' | 'V2_ONLY';
  cohort_rules?: any;
  updated_at?: string;
}

let cachedCapabilities: Record<string, string> | null = null;
let lastFetchTime = 0;

export async function getCapabilities(): Promise<FeatureCapability[]> {
  try {
    const res = await fetchApi<{ capabilities: FeatureCapability[] }>('/cutover/capabilities');
    const caps = res.capabilities || [];
    
    const cacheMap: Record<string, string> = {};
    caps.forEach(c => {
      cacheMap[c.feature_key] = c.status;
    });
    cachedCapabilities = cacheMap;
    lastFetchTime = Date.now();

    return caps;
  } catch (err) {
    console.warn("Cutover Capabilities alınamadı:", err);
    return [];
  }
}

export async function isFeatureFrozen(featureKey: string): Promise<boolean> {
  if (!cachedCapabilities || Date.now() - lastFetchTime > 30000) {
    await getCapabilities();
  }
  const status = cachedCapabilities?.[featureKey];
  return status === 'FROZEN';
}

export async function sendShadowCompare(featureKey: string, entityId: string, legacyData: any): Promise<void> {
  try {
    await fetchApi('/cutover/shadow-compare', {
      method: 'POST',
      body: JSON.stringify({
        featureKey,
        entityId,
        legacyData
      })
    });
  } catch (err) {
    console.warn("Shadow Compare gönderimi başarısız:", err);
  }
}

export async function changeFeatureStatus(
  featureKey: string, 
  newStatus: string, 
  actorId: string, 
  reason: string
): Promise<boolean> {
  try {
    await fetchApi('/cutover/status-change', {
      method: 'POST',
      body: JSON.stringify({
        featureKey,
        newStatus,
        actorId,
        reason
      })
    });
    // Invalidate cache
    cachedCapabilities = null;
    return true;
  } catch (err) {
    console.error("Status değişimi başarısız:", err);
    return false;
  }
}
