/**
 * Paket 00 feature flag sınırı.
 *
 * Üretim kodu flag'i yalnız bu resolver üzerinden okur. Paket 00'da flag
 * hiçbir eski akışa bağlanmaz; bu, paralel v2 temelinin kapalı başlangıcıdır.
 */

export const FEATURE_FLAGS = {
  domain_v2_foundation: 'VITE_DOMAIN_V2_FOUNDATION'
} as const;

export type FeatureFlagName = keyof typeof FEATURE_FLAGS;
export type FeatureFlagSource = 'TEST_OVERRIDE' | 'ENVIRONMENT' | 'DEFAULT';
export type FeatureFlagWarning = 'INVALID_FEATURE_FLAG_VALUE';

export interface FeatureFlagResolution {
  readonly name: FeatureFlagName;
  readonly enabled: boolean;
  readonly source: FeatureFlagSource;
  readonly warning?: FeatureFlagWarning;
}

export type FeatureFlagEnvironment = Readonly<Record<string, string | undefined>>;

const testOverrides = new Map<FeatureFlagName, boolean>();

function getRuntimeEnvironment(): FeatureFlagEnvironment {
  return import.meta.env as FeatureFlagEnvironment;
}

function parseFlagValue(rawValue: string): boolean | undefined {
  if (rawValue === 'true' || rawValue === '1') return true;
  if (rawValue === 'false' || rawValue === '0') return false;
  return undefined;
}

export function setFeatureFlagTestOverride(name: FeatureFlagName, enabled: boolean | undefined): void {
  if (enabled === undefined) {
    testOverrides.delete(name);
    return;
  }

  testOverrides.set(name, enabled);
}

export function clearFeatureFlagTestOverrides(): void {
  testOverrides.clear();
}

export function resolveFeatureFlag(
  name: FeatureFlagName,
  environment: FeatureFlagEnvironment = getRuntimeEnvironment()
): FeatureFlagResolution {
  const testOverride = testOverrides.get(name);
  if (testOverride !== undefined) {
    return { name, enabled: testOverride, source: 'TEST_OVERRIDE' };
  }

  const rawValue = environment[FEATURE_FLAGS[name]];
  if (rawValue === undefined) {
    return { name, enabled: false, source: 'DEFAULT' };
  }

  const parsedValue = parseFlagValue(rawValue);
  if (parsedValue === undefined) {
    return {
      name,
      enabled: false,
      source: 'ENVIRONMENT',
      warning: 'INVALID_FEATURE_FLAG_VALUE'
    };
  }

  return { name, enabled: parsedValue, source: 'ENVIRONMENT' };
}
