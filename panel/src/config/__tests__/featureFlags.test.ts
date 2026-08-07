import { afterEach, describe, expect, it } from 'vitest';
import {
  clearFeatureFlagTestOverrides,
  resolveFeatureFlag,
  setFeatureFlagTestOverride
} from '../featureFlags';
import { parseAmount } from '../../parsers/salesParser';
import { formatCurrency } from '../../services/customerService';
import { getQueryIntent, getRelevantToolsForQuery } from '../../services/aiTools';
import { createAnonymousDomainFixture } from '../../test/fixtures/anonymousDomainFixtures';

afterEach(() => {
  clearFeatureFlagTestOverrides();
});

describe('P00-FLG — domain_v2_foundation resolver', () => {
  it('is closed by default and accepts only the documented environment values', () => {
    expect(resolveFeatureFlag('domain_v2_foundation', {})).toEqual({
      name: 'domain_v2_foundation', enabled: false, source: 'DEFAULT'
    });
    expect(resolveFeatureFlag('domain_v2_foundation', { VITE_DOMAIN_V2_FOUNDATION: 'true' }).enabled).toBe(true);
    expect(resolveFeatureFlag('domain_v2_foundation', { VITE_DOMAIN_V2_FOUNDATION: '1' }).enabled).toBe(true);
    expect(resolveFeatureFlag('domain_v2_foundation', { VITE_DOMAIN_V2_FOUNDATION: 'false' }).enabled).toBe(false);
    expect(resolveFeatureFlag('domain_v2_foundation', { VITE_DOMAIN_V2_FOUNDATION: '0' }).enabled).toBe(false);
  });

  it('fails closed with a visible warning for an invalid environment value', () => {
    expect(resolveFeatureFlag('domain_v2_foundation', { VITE_DOMAIN_V2_FOUNDATION: 'enabled' })).toEqual({
      name: 'domain_v2_foundation',
      enabled: false,
      source: 'ENVIRONMENT',
      warning: 'INVALID_FEATURE_FLAG_VALUE'
    });
  });

  it('gives the isolated test override precedence over environment values', () => {
    setFeatureFlagTestOverride('domain_v2_foundation', false);

    expect(resolveFeatureFlag('domain_v2_foundation', { VITE_DOMAIN_V2_FOUNDATION: 'true' })).toEqual({
      name: 'domain_v2_foundation', enabled: false, source: 'TEST_OVERRIDE'
    });

    clearFeatureFlagTestOverrides();
    expect(resolveFeatureFlag('domain_v2_foundation', { VITE_DOMAIN_V2_FOUNDATION: 'true' })).toEqual({
      name: 'domain_v2_foundation', enabled: true, source: 'ENVIRONMENT'
    });
  });

  it('does not alter legacy parser, customer formatting or AI routing while closed', () => {
    const fixture = createAnonymousDomainFixture();
    const before = {
      parsedAmount: parseAmount('1.234,50'),
      customerAmount: formatCurrency(Number(fixture.twoDecimalAmount)),
      aiIntent: getQueryIntent('tahsilat özeti'),
      selectedTools: getRelevantToolsForQuery('tahsilat özeti').map((tool) => tool.name)
    };

    expect(resolveFeatureFlag('domain_v2_foundation', {}).enabled).toBe(false);

    const after = {
      parsedAmount: parseAmount('1.234,50'),
      customerAmount: formatCurrency(Number(fixture.twoDecimalAmount)),
      aiIntent: getQueryIntent('tahsilat özeti'),
      selectedTools: getRelevantToolsForQuery('tahsilat özeti').map((tool) => tool.name)
    };

    expect(after).toEqual(before);
  });
});
