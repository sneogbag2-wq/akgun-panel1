import { parseUuid } from '../imports/importContracts.js';
import { parseMonth, SelloutContractError } from './selloutContract.js';

export function validateTargetDraft(input) {
  parseMonth(input?.periodKey);
  
  if (input?.targetLitres == null) {
    return Object.freeze({ ...input, targetLitres: 'MISSING_SOURCE' });
  }

  if (!['OPEN', 'CLOSED'].includes(input?.channel) || typeof input?.targetLitres !== 'string' || !/^\d+(?:\.\d+)?$/u.test(input.targetLitres) || !input?.reason?.trim()) {
    throw new SelloutContractError('INVALID_TARGET_DRAFT');
  }
  return Object.freeze({
    ...input,
    targetLitres: input.targetLitres.replace(/(\.\d*?)0+$/u, '$1').replace(/\.$/u, '')
  });
}

export function createSelloutTargetService(repository) {
  if (!repository) throw new TypeError('Sellout repository is required');

  const previewHash = (body) => {
    if (typeof body?.previewHash !== 'string') throw new SelloutContractError('INVALID_RESOLUTION_PREVIEW');
    const { previewHash: hash, ...input } = body;
    return { hash, input };
  };

  return Object.freeze({
    targets: (q) => repository.targets({ month: parseMonth(q.month), repId: q.repId ?? null }),
    targetPreview: (body) => repository.targetPreview(body),
    targetCommit: (body) => {
      const x = previewHash(body);
      return repository.targetCommit(x.input, x.hash);
    },
    targetReverse: (id, body) => repository.targetReverse(parseUuid(id, 'targetVersionId'), body?.reason)
  });
}
