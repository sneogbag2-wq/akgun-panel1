import { describe, it, expect } from 'vitest';
import { parseAmount } from '../salesParser';

describe('parseAmount', () => {
  it('TR binlik ayraçlı, ondalıksız tutarları doğru parse eder (kritik regresyon testi)', () => {
    expect(parseAmount('15.000')).toBe(15000);
    expect(parseAmount('100.000')).toBe(100000);
    expect(parseAmount('1.500.000')).toBe(1500000);
    expect(parseAmount('250.000')).toBe(250000);
  });

  it('TR formatı (nokta=binlik, virgül=ondalık) tutarları parse eder', () => {
    expect(parseAmount('1.234,56')).toBeCloseTo(1234.56);
    expect(parseAmount('1.234.567,89')).toBeCloseTo(1234567.89);
  });

  it('EN formatı (virgül=binlik, nokta=ondalık) tutarları parse eder', () => {
    expect(parseAmount('1,234.56')).toBeCloseTo(1234.56);
  });

  it('Sadece virgül içeren TR ondalık tutarları parse eder', () => {
    expect(parseAmount('1234,56')).toBeCloseTo(1234.56);
  });

  it('Tek nokta ile ondalık tutarları (1-2 haneli kesir) doğru ayırt eder', () => {
    expect(parseAmount('1234.56')).toBeCloseTo(1234.56);
    expect(parseAmount('12.5')).toBeCloseTo(12.5);
    expect(parseAmount('0.99')).toBeCloseTo(0.99);
  });

  it('Negatif tutarları destekler', () => {
    expect(parseAmount('-1.500.000')).toBe(-1500000);
  });

  it('Zaten number tipindeki değerleri olduğu gibi döner', () => {
    expect(parseAmount(1500000)).toBe(1500000);
    expect(parseAmount(15)).toBe(15);
  });

  it('Boş/null/undefined değerler için 0 döner', () => {
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount(undefined)).toBe(0);
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('   ')).toBe(0);
  });

  it('Basit tam sayı stringlerini parse eder', () => {
    expect(parseAmount('250')).toBe(250);
    expect(parseAmount('2500')).toBe(2500);
  });
});
