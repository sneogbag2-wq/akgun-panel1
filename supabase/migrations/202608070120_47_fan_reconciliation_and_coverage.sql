-- Migration: 47_fan_reconciliation_and_coverage
-- Description: Implementation of FAN-020 Financial Reconciliation & FAN-021 Data Coverage Summary

-- FAN-020: fan_reconciliation_result
CREATE TABLE IF NOT EXISTS public.fan_reconciliation_result (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ledger_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    open_lots_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    unallocated_credit NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    open_instruments_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    virman_net_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    unreconciled_difference NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    readiness_status TEXT NOT NULL CHECK (readiness_status IN ('READY', 'READY_WITH_WARNINGS', 'NOT_READY')),
    warnings JSONB DEFAULT '[]'::jsonb,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- FAN-021: fan_coverage_summary
CREATE TABLE IF NOT EXISTS public.fan_coverage_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL,
    metric_code VARCHAR(50) NOT NULL,
    as_of_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expected_rows INT NOT NULL DEFAULT 0,
    processed_rows INT NOT NULL DEFAULT 0,
    expected_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    processed_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    coverage_ratio NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    null_reasons JSONB DEFAULT '{}'::jsonb,
    fallback_level TEXT DEFAULT 'NONE',
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- Add metadata columns to metric_results if not present
ALTER TABLE public.metric_results 
ADD COLUMN IF NOT EXISTS result_class VARCHAR(50) DEFAULT 'FACT',
ADD COLUMN IF NOT EXISTS coverage_ratio NUMERIC(5, 2) DEFAULT 100.00,
ADD COLUMN IF NOT EXISTS reconciliation_status VARCHAR(50) DEFAULT 'READY',
ADD COLUMN IF NOT EXISTS publication_id UUID DEFAULT gen_random_uuid();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_fan_reconcile_calc_run ON public.fan_reconciliation_result(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_fan_coverage_calc_run ON public.fan_coverage_summary(calculation_run_id);
CREATE INDEX IF NOT EXISTS idx_fan_coverage_metric_code ON public.fan_coverage_summary(metric_code);

-- Enable RLS
ALTER TABLE public.fan_reconciliation_result ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fan_coverage_summary ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated read for fan_reconciliation_result" ON public.fan_reconciliation_result FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read for fan_coverage_summary" ON public.fan_coverage_summary FOR SELECT USING (true);
