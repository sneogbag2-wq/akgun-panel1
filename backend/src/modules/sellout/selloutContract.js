import { createHash } from 'node:crypto';
import { parseIdempotencyRequest, parseUuid, requestFingerprint } from '../imports/importContracts.js';
export const SELLOUT_SOURCE_KIND='SELLOUT_TRADITIONAL';
export const SELLOUT_PARSER_VERSION='sellout-v2/1.0.0';
export const SELLOUT_REQUIRED_HEADERS=Object.freeze(['Satış Belgesi','Müşteri No','Malzeme Kodu','Miktar','Litre','Faturalama Tarihi']);
export class SelloutContractError extends Error { constructor(code,messageKey=`sellout.${code.toLowerCase()}`,details={}) { super(code);this.name='SelloutContractError';this.code=code;this.messageKey=messageKey;this.details=details; } }
export const sha256=(value)=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
export const cleanText=(value)=>typeof value==='string'?(value.normalize('NFC').trim().replace(/\s+/gu,' ')||null):null;
export const headerText=(value)=>cleanText(value)?.toLocaleLowerCase('tr-TR')??null;
export const headersMatch=(headers)=>SELLOUT_REQUIRED_HEADERS.every((header)=>headers.map(headerText).includes(headerText(header)));
export function canonicalDecimal(value,{allowNegative=true}={}) { const raw=cleanText(value); if(!raw||!new RegExp(`^${allowNegative?'-?':''}\\d+(?:[.,]\\d+)?$`,'u').test(raw)) return null; const normal=raw.replace(',','.'); const parsed=normal.replace(/^(-?)0+(?=\d)/u,'$1').replace(/(\.[0-9]*?)0+$/u,'$1').replace(/\.$/u,''); return parsed==='-0'?'0':parsed; }
export function canonicalDate(value) { const raw=cleanText(value); if(!raw||!/^\d{4}-\d{2}-\d{2}$/u.test(raw)||Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) return null; return raw; }
export function parseMonth(value) { if(typeof value!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/u.test(value)) throw new SelloutContractError('INVALID_SELLOUT_MONTH'); return value; }
export const page=(value,fallback=1)=>{if(value===undefined||value==='')return fallback;if(typeof value!=='string'||!/^[1-9]\d*$/u.test(value)||Number(value)>100)throw new SelloutContractError('INVALID_PAGINATION');return Number(value);};
export function parsePublishRequest(batchId,body) { const input=parseIdempotencyRequest(body,['expectedValidationRunId','expectedCoverageVersion']); const expectedValidationRunId=parseUuid(input.expectedValidationRunId,'expectedValidationRunId'); if(!Number.isInteger(input.expectedCoverageVersion)||input.expectedCoverageVersion<0)throw new SelloutContractError('INVALID_COVERAGE_VERSION'); return Object.freeze({expectedValidationRunId,expectedCoverageVersion:input.expectedCoverageVersion,idempotencyKey:input.idempotencyKey,requestFingerprint:requestFingerprint({batchId,expectedValidationRunId,expectedCoverageVersion:input.expectedCoverageVersion})}); }
