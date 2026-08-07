import test from 'node:test';
import assert from 'node:assert/strict';
import { createReportExportService } from '../reportExportService.js';

test('Report Export Service Tests (Section 7: PDF & Excel Exporters)', async (t) => {
  const mockRepository = {
    saveReportSnapshot: async () => true,
    saveExportedArtifact: async () => true
  };
  const service = createReportExportService({ repository: mockRepository });

  let snapshot;

  await t.test('generateReportSnapshot creates immutable snapshot envelope', async () => {
    snapshot = await service.generateReportSnapshot({
      title: 'Test Rapor Paketi',
      claims: ['Tahsilat %15 arttı'],
      metricsData: { totalExposure: 50000 }
    });

    assert.ok(snapshot.snapshotId);
    assert.ok(snapshot.manifestId);
    assert.equal(snapshot.title, 'Test Rapor Paketi');
    assert.ok(snapshot.contentHash);
  });

  await t.test('renderPdfReport generates 8 mandatory sections according to Section 7.3', async () => {
    const pdf = await service.renderPdfReport(snapshot, { orientation: 'LANDSCAPE' });

    assert.equal(pdf.format, 'PDF');
    assert.equal(pdf.pageCount, 8);
    assert.equal(pdf.sections.length, 8);

    const cover = pdf.sections.find(s => s.sectionKey === 'COVER');
    assert.ok(cover);
    const execSummary = pdf.sections.find(s => s.sectionKey === 'EXECUTIVE_SUMMARY');
    assert.ok(execSummary);
    const methodology = pdf.sections.find(s => s.sectionKey === 'METHODOLOGY_AND_APPENDIX');
    assert.ok(methodology);
  });

  await t.test('renderExcelWorkbook generates 5 mandatory tabs according to Section 7.4', async () => {
    const excel = await service.renderExcelWorkbook(snapshot);

    assert.equal(excel.format, 'XLSX');
    assert.equal(excel.sheetCount, 5);

    const sheetNames = excel.sheets.map(s => s.sheetName);
    assert.ok(sheetNames.includes('Yönetici Özeti'));
    assert.ok(sheetNames.includes('Dönem Karşılaştırma'));
    assert.ok(sheetNames.includes('Detay Veri'));
    assert.ok(sheetNames.includes('Veri Kalitesi'));
    assert.ok(sheetNames.includes('Metodoloji'));
  });

  await t.test('renderImageReport generates high resolution image artifact', async () => {
    const img = await service.renderImageReport(snapshot, { format: 'PNG' });

    assert.equal(img.format, 'PNG');
    assert.equal(img.resolution, '1920x1080');
  });
});
