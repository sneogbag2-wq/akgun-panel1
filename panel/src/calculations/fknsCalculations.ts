import { searchCustomersSync, getRawSelloutDataSync, isPassiveOrCanceledStatus } from '../services/customerService';
import { ParsedSelloutRecord } from '../parsers/selloutParser';
import { resolveSelloutChannel, resolveChannelFromMaster, customerBelongsToChannel } from '../utils/channelUtils';
import { matchesProductQuery, isValidProductForChannel } from '../utils/productUtils';

export interface FknsResult {
  salesRep: string;
  channel: 'AÇIK' | 'KAPALI' | 'TÜMÜ';
  totalActiveCustomers: number;
  invoicedCustomersCount: number;
  fknsPercentage: number;
  uninvoicedCustomers: { id: string; name: string }[];
  targetMonth?: string;
}

export function calculateFknsForRep(salesRep: string, channelFilter: 'AÇIK' | 'KAPALI' | 'TÜMÜ', targetMonth?: string): FknsResult {
  const selloutData = getRawSelloutDataSync() as ParsedSelloutRecord[];
  
  // 1. Temsilcinin noktalarını ve kanallarını Müşteri Master (Aktif Müşteriler) verisinden öğren
  // NOT: channel alanı artık ham kanal metnini saklıyor (resolve edilmemiş); filtreleme
  // sırasında customerBelongsToChannel kullanılarak KARMA (Açık+Kapalı birleşik) müşteriler
  // her iki kanal raporuna da doğru şekilde dahil ediliyor.
  const repCustomersMap = new Map<string, {name: string, rawChannel: string}>();
  const allCustomers = searchCustomersSync('');
  const searchRep = (salesRep || '').trim().toLowerCase();
  
  for (const c of allCustomers) {
    if (isPassiveOrCanceledStatus(c.customerStatus || c.status)) continue;
    
    const cRep = String(c.salesRep || '').trim().toLowerCase();
    const cRepName = String(c.salesRepName || '').trim().toLowerCase();
    
    if (!searchRep || searchRep === 'tümü' || cRep === searchRep || cRepName === searchRep) {
      const channelVal = String(c.salesChannel || c.channel || '');
      repCustomersMap.set(c.customerId, { 
        name: c.customerName || c.title || '', 
        rawChannel: channelVal
      });
    }
  }

  let targetCustomers = Array.from(repCustomersMap.entries()).map(([id, info]) => ({ id, ...info }));

  // Kanal Filtresi (KARMA müşteriler her iki kanala da dahil edilir)
  if (channelFilter !== 'TÜMÜ') {
    targetCustomers = targetCustomers.filter(c => customerBelongsToChannel(c.rawChannel, channelFilter));
  }

  const totalActiveCustomers = targetCustomers.length;
  if (totalActiveCustomers === 0) {
    return { salesRep, channel: channelFilter, totalActiveCustomers: 0, invoicedCustomersCount: 0, fknsPercentage: 0, uninvoicedCustomers: [] };
  }

  // 2. O ay kimlere fatura kesildi?
  const invoicedSet = new Set<string>();
  for (const s of selloutData) {
    if (repCustomersMap.has(s.customerId)) {
      if (channelFilter === 'TÜMÜ' || s.channel === channelFilter || s.channel === 'KARMA') {
        // Eğer targetMonth verildiyse (Örn: "2026-07"), sadece o aya ait faturaları say
        if (!targetMonth || s.date.startsWith(targetMonth)) {
          if (s.netAmount > 0 || s.liters > 0 || s.quantity > 0) {
            invoicedSet.add(s.customerId);
          }
        }
      }
    }
  }

  const invoicedCustomersCount = invoicedSet.size;
  const fknsPercentage = Math.round((invoicedCustomersCount / totalActiveCustomers) * 100);

  const uninvoicedCustomers = targetCustomers
    .filter(c => !invoicedSet.has(c.id))
    .map(c => ({ id: c.id, name: c.name }));

  const invoicedCustomers = targetCustomers
    .filter(c => invoicedSet.has(c.id))
    .map(c => ({ id: c.id, name: c.name }));

  return {
    salesRep,
    channel: channelFilter,
    targetMonth,
    totalActiveCustomers,
    invoicedCustomersCount,
    fknsPercentage,
    uninvoicedCustomers,
    invoicedCustomers
  };
}

export interface ProductPenetrationResult {
  salesRep: string;
  materialName: string;
  channel: 'AÇIK' | 'KAPALI' | 'TÜMÜ';
  totalActiveCustomers: number;
  buyersCount: number;
  penetrationPercentage: number;
  nonBuyers: { id: string; name: string }[];
  buyers?: { id: string; name: string }[];
  targetMonth?: string;
  isIrrelevant?: boolean;
}

export function calculateProductPenetration(salesRep: string, materialName: string, channelFilter: 'AÇIK' | 'KAPALI' | 'TÜMÜ', targetMonth?: string): ProductPenetrationResult {
  const selloutData = getRawSelloutDataSync() as ParsedSelloutRecord[];
  
  // Ürün hedeflenebilir mi kontrolü
  const isIrr = channelFilter !== 'TÜMÜ' ? !isValidProductForChannel(materialName, '', channelFilter) : false;

  const repCustomersMap = new Map<string, {name: string, rawChannel: string}>();
  const allCustomers = searchCustomersSync('');
  const searchRep = (salesRep || '').trim().toLowerCase();
  
  for (const c of allCustomers) {
    if (isPassiveOrCanceledStatus(c.customerStatus || c.status)) continue;
    
    const cRep = String(c.salesRep || '').trim().toLowerCase();
    const cRepName = String(c.salesRepName || '').trim().toLowerCase();
    
    if (!searchRep || searchRep === 'tümü' || cRep === searchRep || cRepName === searchRep) {
      const channelVal = String(c.salesChannel || c.channel || '');
      repCustomersMap.set(c.customerId, { 
        name: c.customerName || c.title || '', 
        rawChannel: channelVal
      });
    }
  }

  let targetCustomers = Array.from(repCustomersMap.entries()).map(([id, info]) => ({ id, ...info }));
  if (channelFilter !== 'TÜMÜ') {
    targetCustomers = targetCustomers.filter(c => customerBelongsToChannel(c.rawChannel, channelFilter));
  }

  const totalActiveCustomers = targetCustomers.length;
  if (totalActiveCustomers === 0 || isIrr) {
    return { salesRep, materialName, channel: channelFilter, totalActiveCustomers, buyersCount: 0, penetrationPercentage: 0, nonBuyers: [], buyers: [], isIrrelevant: isIrr };
  }

  const buyersSet = new Set<string>();
  for (const s of selloutData) {
    if (repCustomersMap.has(s.customerId) && matchesProductQuery(s.materialCode, s.materialName, materialName)) {
      if (channelFilter === 'TÜMÜ' || s.channel === channelFilter || s.channel === 'KARMA') {
        if (!targetMonth || s.date.startsWith(targetMonth)) {
          if (s.netAmount > 0 || s.liters > 0 || s.quantity > 0) {
            buyersSet.add(s.customerId);
          }
        }
      }
    }
  }

  const buyersCount = buyersSet.size;
  const penetrationPercentage = Math.round((buyersCount / totalActiveCustomers) * 100);

  const nonBuyers = targetCustomers
    .filter(c => !buyersSet.has(c.id))
    .map(c => ({ id: c.id, name: c.name }));

  const buyers = targetCustomers
    .filter(c => buyersSet.has(c.id))
    .map(c => ({ id: c.id, name: c.name }));

  return {
    salesRep,
    materialName,
    channel: channelFilter,
    totalActiveCustomers,
    buyersCount,
    penetrationPercentage,
    nonBuyers,
    buyers,
    targetMonth,
    isIrrelevant: isIrr
  };
}

export interface RepFknsBreakdown {
  salesRep: string;
  totalActive: number;
  totalInvoiced: number;
  overallPercentage: number;
  openChannel: {
    total: number;
    invoiced: number;
    percentage: number;
    uninvoicedList: { id: string; name: string }[];
  };
  closedChannel: {
    total: number;
    invoiced: number;
    percentage: number;
    uninvoicedList: { id: string; name: string }[];
  };
}

export function calculateRepFknsBreakdown(salesRep: string, productQuery = '', targetMonth?: string): RepFknsBreakdown {
  const selloutData = getRawSelloutDataSync() as ParsedSelloutRecord[];
  const allCustomers = searchCustomersSync('');
  const searchRep = (salesRep || '').trim().toLowerCase();
  
  // Map customer IDs to sellout channels from sellout records
  const custSelloutChannelsMap = new Map<string, { openCount: number; closedCount: number }>();
  for (const s of selloutData) {
    if (!custSelloutChannelsMap.has(s.customerId)) {
      custSelloutChannelsMap.set(s.customerId, { openCount: 0, closedCount: 0 });
    }
    const counts = custSelloutChannelsMap.get(s.customerId)!;
    if (s.channel === 'KAPALI') counts.closedCount++;
    else if (s.channel === 'AÇIK') counts.openCount++;
  }

  const openCustsMap = new Map<string, string>();
  const closedCustsMap = new Map<string, string>();

  for (const c of allCustomers) {
    // 1. Müşteri Master verisinde Pasif/İptal olan noktaları tamamen filtrele (Sadece Aktif Noktalar)
    if (isPassiveOrCanceledStatus(c.customerStatus || c.status)) continue;

    const cRep = String(c.salesRep || '').trim().toLowerCase();
    const cRepName = String(c.salesRepName || '').trim().toLowerCase();
    
    if (!searchRep || cRep === searchRep || cRepName === searchRep) {
      const custName = c.customerName || c.title || `Cari (${c.customerId})`;
      
      // 2. Kanal bilgisini Sellout Raporundaki 'Müşteri Kanalı Tnm.' verisinden öncelikli al
      // (Standart Açık, Horeca, Otel = Açık Kanal | Standart Kapalı, Ekomini = Kapalı Kanal)
      const selloutCounts = custSelloutChannelsMap.get(c.customerId);
      let isClosed = false;

      if (selloutCounts && (selloutCounts.closedCount > 0 || selloutCounts.openCount > 0)) {
        isClosed = selloutCounts.closedCount > selloutCounts.openCount;
      } else {
        const channelVal = String(c.salesChannel || c.channel || '');
        const assignedChannel = resolveSelloutChannel(channelVal);
        isClosed = assignedChannel === 'KAPALI';
      }

      if (isClosed) {
        closedCustsMap.set(c.customerId, custName);
      } else {
        openCustsMap.set(c.customerId, custName);
      }
    }
  }

  const openInvoicedSet = new Set<string>();
  const closedInvoicedSet = new Set<string>();
  const searchMat = (productQuery || '').trim().toLowerCase();
  const searchMatClean = searchMat.replace(/^0+/, '');

  // 3. Şirket genelinde bu ürünün HANGİ KANALLARDA satıldığını tespit et (Akıllı Kanal İlgililik Filtresi)
  let globalOpenSalesCount = 0;
  let globalClosedSalesCount = 0;

  for (const s of selloutData) {
    if (s.netAmount <= 0 && s.liters <= 0 && s.quantity <= 0) continue;

    if (searchMat) {
      if (!matchesProductQuery(s.materialCode, s.materialName, searchMat)) continue;
    }

    if (s.channel === 'KAPALI') {
      globalClosedSalesCount++;
    } else {
      globalOpenSalesCount++;
    }

    if (targetMonth && !s.date.startsWith(targetMonth)) continue;

    if (openCustsMap.has(s.customerId)) {
      openInvoicedSet.add(s.customerId);
    } else if (closedCustsMap.has(s.customerId)) {
      closedInvoicedSet.add(s.customerId);
    }
  }

  // Eğer ürün bazlı arama yapılıyorsa ve ürün bir kanalda nadiren satılıyorsa (Örn: %5'ten az)
  // VEYA isminde belirli anahtar kelimeler geçiyorsa (Fıçı ürünlerin Kapalı Kanal'da satılmaması)
  // O kanalı bu ürün için 'İlgisiz Kanal' olarak işaretle ve hedef/ceza dışı bırak!
  const isProductSearch = Boolean(searchMat);
  const isFici = isProductSearch && (searchMat.includes('fiçi') || searchMat.includes('fıçı') || searchMat.includes('fic'));
  const isKutu = isProductSearch && (searchMat.includes('kutu') || searchMat.includes('ktu'));

  const totalGlobalSales = globalOpenSalesCount + globalClosedSalesCount;
  const openChannelRatio = totalGlobalSales > 0 ? (globalOpenSalesCount / totalGlobalSales) : 0;
  const closedChannelRatio = totalGlobalSales > 0 ? (globalClosedSalesCount / totalGlobalSales) : 0;

  // Açık kanal, 'Kutu' değilse ve satış payı en az %5 ise ilgilidir.
  const isOpenChannelRelevant = !isProductSearch || (!isKutu && openChannelRatio >= 0.05);
  // Kapalı kanal, 'Fıçı' değilse ve satış payı en az %5 ise ilgilidir.
  const isClosedChannelRelevant = !isProductSearch || (!isFici && closedChannelRatio >= 0.05);

  const openTotal = isOpenChannelRelevant ? openCustsMap.size : 0;
  const openInvoiced = isOpenChannelRelevant ? openInvoicedSet.size : 0;
  const openPct = openTotal > 0 ? Math.round((openInvoiced / openTotal) * 100) : 0;
  const openUninvoicedList = isOpenChannelRelevant 
    ? Array.from(openCustsMap.entries()).filter(([id]) => !openInvoicedSet.has(id)).map(([id, name]) => ({ id, name }))
    : [];

  const closedTotal = isClosedChannelRelevant ? closedCustsMap.size : 0;
  const closedInvoiced = isClosedChannelRelevant ? closedInvoicedSet.size : 0;
  const closedPct = closedTotal > 0 ? Math.round((closedInvoiced / closedTotal) * 100) : 0;
  const closedUninvoicedList = isClosedChannelRelevant
    ? Array.from(closedCustsMap.entries()).filter(([id]) => !closedInvoicedSet.has(id)).map(([id, name]) => ({ id, name }))
    : [];

  const totalActive = openTotal + closedTotal;
  const totalInvoiced = openInvoiced + closedInvoiced;
  const overallPercentage = totalActive > 0 ? Math.round((totalInvoiced / totalActive) * 100) : 0;

  return {
    salesRep,
    totalActive,
    totalInvoiced,
    overallPercentage,
    openChannel: {
      total: openTotal,
      invoiced: openInvoiced,
      percentage: openPct,
      uninvoicedList: openUninvoicedList,
      isRelevant: isOpenChannelRelevant
    } as any,
    closedChannel: {
      total: closedTotal,
      invoiced: closedInvoiced,
      percentage: closedPct,
      uninvoicedList: closedUninvoicedList,
      isRelevant: isClosedChannelRelevant
    } as any
  };
}
