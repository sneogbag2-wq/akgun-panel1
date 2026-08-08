import { Router } from 'express';

const TABLE_MAP = {
  MUSTERI_MASTER:  { table: 'customers',           onConflict: 'customer_code' },
  SATIS:           { table: 'invoices',             onConflict: 'document_no'  },
  NAKIT_TAHSILAT:  { table: 'payments',             onConflict: 'id'           },
  HAVALE_TAHSILAT: { table: 'payments',             onConflict: 'id'           },
  CEK:             { table: 'cheques',              onConflict: 'id'           },
  SENET:           { table: 'cheques',              onConflict: 'id'           },
  SELLOUT_VERISI:  { table: 'sellout_staging_rows', onConflict: 'id'           },
};

const REQUIRED_FIELDS = {
  MUSTERI_MASTER:  ['customerId'],
  SATIS:           ['invoiceDate', 'amount'],
  NAKIT_TAHSILAT:  ['collectionId', 'amount'],
  HAVALE_TAHSILAT: ['collectionId', 'amount'],
  CEK:             ['id', 'amount'],
  SENET:           ['id', 'amount'],
  SELLOUT_VERISI:  ['litre'],
};

// Parser çıktısı → Supabase kolon eşlemesi (GERÇEK DÖNÜŞÜM KODU)
const TRANSFORMS = {
  MUSTERI_MASTER:  (r) => ({ customer_code: String(r.customerId || '') }),
  SATIS:           (r) => ({ document_no: r.eDocumentNo || r.invoiceId, billing_date: r.invoiceDate, amount: Number(r.amount) || 0 }),
  NAKIT_TAHSILAT:  (r) => ({ id: r.collectionId, amount: Number(r.amount) || 0, payment_date: r.date, status: r.status || 'CREATED' }),
  HAVALE_TAHSILAT: (r) => ({ id: r.collectionId, amount: Number(r.amount) || 0, payment_date: r.date, status: r.status || 'CREATED' }),
  CEK:             (r) => ({ id: r.id, amount: Number(r.amount) || 0, due_date: r.dueDate, doc_no: r.docNo, type: 'CEK',   status: r.status }),
  SENET:           (r) => ({ id: r.id, amount: Number(r.amount) || 0, due_date: r.dueDate, doc_no: r.docNo, type: 'SENET', status: r.status }),
  SELLOUT_VERISI:  (r) => ({ id: r.id || r.faturaNo, billing_date: r.tarih, net_sales_litres: Number(r.litre) || 0 }),
};

/**
 * Application-layer yetkilendirme: zorunlu alan kontrolü.
 * Tek-şirket dahili panel — authenticated her kullanıcı tüm firma verisini yazabilir.
 * Tenant izolasyonu bu mimari için geçerli değildir (GETTING-STARTED.md).
 */
function validateRecords(fileTypeKey, records) {
  const required = REQUIRED_FIELDS[fileTypeKey] || [];
  for (const rec of records) {
    for (const field of required) {
      if (rec[field] === undefined || rec[field] === null) {
        return { ok: false, reason: `'${field}' alanı boş olamaz` };
      }
    }
  }
  return { ok: true };
}

export function createUploadSyncRouter({ requireSupabaseUser, createRepositoryForAccessToken }) {
  const router = Router();

  router.post('/', requireSupabaseUser, async (req, res) => {
    // Katman 1: Authentication — requireSupabaseUser middleware zaten doğruladı
    if (!req.authUser?.id) {
      return res.status(403).json({ error: 'Kimlik doğrulama başarısız' });
    }

    const { fileTypeKey, records } = req.body;
    if (!fileTypeKey || !Array.isArray(records)) {
      return res.status(400).json({ error: 'fileTypeKey ve records zorunlu' });
    }

    const mapping = TABLE_MAP[fileTypeKey];
    if (!mapping) {
      return res.json({ skipped: true, reason: 'unsupported_type' });
    }

    // Katman 2: Application-layer authorization — zorunlu alan kontrolü
    const validation = validateRecords(fileTypeKey, records);
    if (!validation.ok) {
      return res.status(400).json({ error: `Geçersiz veri: ${validation.reason}` });
    }

    // userClient: kullanıcı token'ı ile RLS devreye girer (serviceClient değil)
    const userClient = createRepositoryForAccessToken(req.authUser.accessToken);
    const transform = TRANSFORMS[fileTypeKey];
    const transformed = records
      .map(transform)
      .filter(r => Object.values(r).some(v => v !== undefined && v !== null && v !== ''));

    const { error } = await userClient
      .from(mapping.table)
      .upsert(transformed, { onConflict: mapping.onConflict });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, count: transformed.length });
  });

  return router;
}
