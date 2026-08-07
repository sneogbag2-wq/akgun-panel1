-- Paket 13: Merkezi Metrik Motoru (Registry ve Run İzolasyonu)

CREATE TABLE IF NOT EXISTS metric_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL, -- Örn: FIN-013, STK-018
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- Örn: CALCULATION, AGGREGATION, AI_ESTIMATE
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metric_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    definition_id UUID NOT NULL REFERENCES metric_definitions(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    logic_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(definition_id, version_number)
);

CREATE TABLE IF NOT EXISTS metric_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_metric_id UUID NOT NULL REFERENCES metric_definitions(id) ON DELETE CASCADE,
    dependent_metric_id UUID NOT NULL REFERENCES metric_definitions(id) ON DELETE CASCADE,
    UNIQUE(source_metric_id, dependent_metric_id)
);

CREATE TABLE IF NOT EXISTS metric_parameters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_id UUID NOT NULL REFERENCES metric_definitions(id) ON DELETE CASCADE,
    param_name VARCHAR(100) NOT NULL,
    param_value JSONB NOT NULL,
    UNIQUE(metric_id, param_name)
);

CREATE TABLE IF NOT EXISTS calculation_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, SUCCESS, FAILED
    run_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metric_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES calculation_runs(run_id) ON DELETE CASCADE,
    customer_id VARCHAR(50) NOT NULL,
    metric_code VARCHAR(50) NOT NULL, -- Örn: 'FIN-013', 'FIN-014'
    metric_value NUMERIC(15, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency (Bir run içinde bir müşteri için aynı metrik sadece bir kez yazılabilir)
CREATE UNIQUE INDEX idx_unique_metric_per_run ON metric_results(run_id, customer_id, metric_code);
