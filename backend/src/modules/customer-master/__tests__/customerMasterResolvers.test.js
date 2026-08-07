import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIssueState, parseOrganizationScope, toCustomerMasterRecord } from '../customerMasterContract.js';
import { resolveProfile } from '../customerProfileResolver.js';
import { resolveCustomerStatus } from '../customerStatusResolver.js';
import { resolveChannel, resolveSegment } from '../channelSegmentResolver.js';
import { resolveCustomerRep, resolveRepSsm } from '../organizationResolver.js';
import { anonymousHeaderMap, anonymousMasterRow } from '../../../test/anonymousCustomerMasterFixtures.js';

function record(options) {
  const row = anonymousMasterRow(options);
  return toCustomerMasterRecord({ sheetName: 'Master', sourceRowNumber: row.rowNumber, rawCells: row.rawCells, headerMap: anonymousHeaderMap });
}

test('customer code remains source text and numeric or dotted values are rejected without zero filling', () => {
  assert.equal(record({ customerCode: '5000000123' }).customerCodeCandidate, '5000000123');
  assert.equal(record({ customerCode: 5000000123, customerCodeType: 'number' }).customerCodeValid, false);
  assert.equal(record({ customerCode: '500.000.0123' }).customerCodeValid, false);
  assert.equal(record({ customerCode: '5e9' }).customerCodeValid, false);
});

test('organization scope and exception state remain explicit typed query boundaries', () => {
  assert.equal(parseOrganizationScope(undefined), 'SALES');
  assert.equal(parseOrganizationScope('all'), 'ALL');
  assert.equal(parseIssueState('waived'), 'WAIVED');
  assert.throws(() => parseOrganizationScope('customer'), { code: 'INVALID_ORGANIZATION_SCOPE' });
  assert.throws(() => parseIssueState('closed'), { code: 'INVALID_ISSUE_STATE' });
});

test('profile selection is row-order independent, fills only from matching sibling values and never adds division text', () => {
  const rows = [record({ customerName: 'Anonim Market', storeName: '' }), record({ rowNumber: 3, customerName: ' anonim   market ', storeName: 'Anonim Tabela' })];
  const result = resolveProfile(rows.reverse());
  assert.equal(result.resolutionState, 'RESOLVED');
  assert.equal(result.profile.customerName, 'anonim market');
  assert.equal(result.profile.storeName, 'Anonim Tabela');
  assert.equal(JSON.stringify(result.profile).includes('Bira'), false);
});

test('status priority follows the approved ACTIVE PASSIVE CANCELLED UNKNOWN ordering', () => {
  assert.equal(resolveCustomerStatus([record({ customerStatus: 'Aktif' }), record({ rowNumber: 3, customerStatus: 'Pasif' })]).status, 'ACTIVE');
  assert.equal(resolveCustomerStatus([record({ customerStatus: 'Aktif (A)' }), record({ rowNumber: 3, customerStatus: 'Pasif (P)' })]).status, 'ACTIVE');
  assert.equal(resolveCustomerStatus([record({ customerStatus: 'Aktif' }), record({ rowNumber: 3, customerStatus: 'İptal' })]).status, 'ACTIVE');
  assert.equal(resolveCustomerStatus([record({ customerStatus: 'Pasif' }), record({ rowNumber: 3, customerStatus: 'İptal' })]).status, 'PASSIVE');
  assert.equal(resolveCustomerStatus([record({ customerStatus: 'İptal' })]).status, 'CANCELLED');
  assert.equal(resolveCustomerStatus([record({ customerStatus: 'İptal (C)' })]).status, 'CANCELLED');
  assert.equal(resolveCustomerStatus([record({ customerStatus: 'İptal' }), record({ rowNumber: 3, customerStatus: 'Bilinmiyor' })]).status, 'UNKNOWN');
});

test('channel and segment conflicts do not become a second KPI membership or a fallback channel', () => {
  const rows = [record({ channel: 'Standart Açık', segment: 'Diamond' }), record({ rowNumber: 3, channel: 'Ekomini', segment: 'Gold' })];
  assert.deepEqual(resolveChannel(rows), { channel: 'UNCLASSIFIED', resolutionState: 'REVIEW_REQUIRED', issues: ['CHANNEL_CONFLICT'] });
  assert.deepEqual(resolveSegment(rows), { segment: 'UNCLASSIFIED_SEGMENT', resolutionState: 'REVIEW_REQUIRED', issues: ['SEGMENT_CONFLICT'] });
});

test('representative and SSM resolution uses unique active customers and the exact 90 percent boundary', () => {
  assert.equal(resolveCustomerRep([record({ salesRep: 'A' }), record({ rowNumber: 3, salesRep: 'B' })]).resolutionState, 'REVIEW_REQUIRED');
  const ninety = Array.from({ length: 10 }, (_, index) => ({ customerCode: `5000000${index}`, rows: [record({ rowNumber: index + 2, distSalesChief: index < 9 ? 'S1' : 'S2' })] }));
  assert.equal(resolveRepSsm(ninety).resolutionState, 'RESOLVED');
  const below = Array.from({ length: 10_000 }, (_, index) => ({ customerCode: `500${String(index).padStart(7, '0')}`, rows: [record({ rowNumber: index + 2, distSalesChief: index < 8_999 ? 'S1' : 'S2' })] }));
  assert.equal(resolveRepSsm(below).resolutionState, 'REVIEW_REQUIRED');
});
