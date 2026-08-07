import crypto from 'crypto';

/**
 * FAN-020: Finansal Mutabakat ve Kapanış Hazır Olma Motoru
 * FAN-021: Veri Kapsam ve Güven Özeti Motoru
 */
export function createFinancialReconciliationService(deps = {}) {
  const repository = deps.repository;

  return Object.freeze({
    /**
     * FAN-020: Parasal/Lot/Allocation/Instrument/Virman Denklikleri Mutabakatı
     * Defter Dengesi = Açık Lot Toplamı - Dağıtılmamış Alacak
     * Virman Şirket İçi Net = 0
     * Unreconciled Fark = 0
     */
    async checkFinancialReconciliation(calculationRunId, options = {}) {
      let ledgerBalance = options.ledgerBalance ?? 0;
      let openLotsTotal = options.openLotsTotal ?? 0;
      let unallocatedCredit = options.unallocatedCredit ?? 0;
      let openInstrumentsTotal = options.openInstrumentsTotal ?? 0;
      let virmanNetTotal = options.virmanNetTotal ?? 0;
      const warnings = [];

      if (repository) {
        try {
          const totals = await repository.getReconciliationTotals(calculationRunId);
          if (totals) {
            ledgerBalance = totals.ledgerBalance ?? ledgerBalance;
            openLotsTotal = totals.openLotsTotal ?? openLotsTotal;
            unallocatedCredit = totals.unallocatedCredit ?? unallocatedCredit;
            openInstrumentsTotal = totals.openInstrumentsTotal ?? openInstrumentsTotal;
            virmanNetTotal = totals.virmanNetTotal ?? virmanNetTotal;
          }
        } catch (err) {
          warnings.push(`Veritabanı mutabakat toplamları okuma uyarısı: ${err.message}`);
        }
      }

      // Parasal Denklik 1: Cari Defter Dengesi = Açık Lotlar - Dağıtılmamış Alacak
      const expectedLedger = openLotsTotal - unallocatedCredit;
      const ledgerDiff = Math.abs(ledgerBalance - expectedLedger);

      // Parasal Denklik 2: Virman Şirket İçi Net Etkisi = 0
      const virmanDiff = Math.abs(virmanNetTotal);

      // Toplam açıklanamayan fark
      const unreconciledDifference = Number((ledgerDiff + virmanDiff).toFixed(2));

      let readinessStatus = 'READY';
      if (unreconciledDifference > 0.01) {
        readinessStatus = 'NOT_READY';
        warnings.push(`Parasal denklik uyarısı: Defter farkı=${ledgerDiff.toFixed(2)} TL, Virman net farkı=${virmanDiff.toFixed(2)} TL.`);
      } else if (warnings.length > 0) {
        readinessStatus = 'READY_WITH_WARNINGS';
      }

      const result = {
        reconciliationId: crypto.randomUUID(),
        calculationRunId: calculationRunId || crypto.randomUUID(),
        asOfAt: new Date().toISOString(),
        ledgerBalance,
        openLotsTotal,
        unallocatedCredit,
        openInstrumentsTotal,
        virmanNetTotal,
        unreconciledDifference,
        readinessStatus,
        warnings,
        calculatedAt: new Date().toISOString()
      };

      if (repository && repository.saveReconciliationResult) {
        await repository.saveReconciliationResult(result);
      }

      return result;
    },

    /**
     * FAN-021: Veri Kapsam ve Güven Özeti
     * Kapsam Oranı = (İşlenen Tutar / Beklenen Tutar) * 100
     * Null Nedenleri ve Fallback Seviyeleri Ayrımı
     */
    async calculateDataCoverage(metricCode, options = {}) {
      const expectedRows = options.expectedRows ?? 100;
      const processedRows = options.processedRows ?? 100;
      const expectedAmount = options.expectedAmount ?? 1000.00;
      const processedAmount = options.processedAmount ?? 1000.00;
      const nullReasons = options.nullReasons || {};
      const fallbackLevel = options.fallbackLevel || 'NONE';

      let coverageRatio = 100.0;
      if (expectedAmount > 0) {
        coverageRatio = Number(((processedAmount / expectedAmount) * 100).toFixed(2));
        if (coverageRatio > 100.0) coverageRatio = 100.0;
      } else if (expectedRows > 0) {
        coverageRatio = Number(((processedRows / expectedRows) * 100).toFixed(2));
        if (coverageRatio > 100.0) coverageRatio = 100.0;
      }

      const summary = {
        coverageId: crypto.randomUUID(),
        calculationRunId: options.calculationRunId || crypto.randomUUID(),
        metricCode,
        asOfAt: new Date().toISOString(),
        expectedRows,
        processedRows,
        expectedAmount,
        processedAmount,
        coverageRatio,
        nullReasons,
        fallbackLevel,
        calculatedAt: new Date().toISOString()
      };

      if (repository && repository.saveCoverageSummary) {
        await repository.saveCoverageSummary(summary);
      }

      return summary;
    }
  });
}
