import { describe, it, expect } from 'vitest';
import { formatDurationLabel, resolveTimeFormatter } from './grid';

describe('formatDurationLabel', () => {
  it('zero → "0"', () => {
    expect(formatDurationLabel(0)).toBe('0');
  });

  it('hours below one day', () => {
    expect(formatDurationLabel(3600_000)).toBe('1h');
    expect(formatDurationLabel(6 * 3600_000)).toBe('6h');
  });

  it('days below one month', () => {
    expect(formatDurationLabel(86_400_000)).toBe('1d');
    expect(formatDurationLabel(7 * 86_400_000)).toBe('7d');
  });

  it('months on the 30-day approximation', () => {
    expect(formatDurationLabel(30 * 86_400_000)).toBe('1M');
    expect(formatDurationLabel(90 * 86_400_000)).toBe('3M');
    expect(formatDurationLabel(180 * 86_400_000)).toBe('6M');
  });

  it('years on the 365-day approximation', () => {
    expect(formatDurationLabel(365 * 86_400_000)).toBe('1Y');
    expect(formatDurationLabel(2 * 365 * 86_400_000)).toBe('2Y');
  });

  it('combines two most-significant units', () => {
    // 1 year + 3 months
    expect(formatDurationLabel((365 + 90) * 86_400_000)).toBe('1Y 3M');
    // 6 months + a few days — days shown when there's room
    expect(formatDurationLabel((180 + 5) * 86_400_000)).toBe('6M 5d');
  });

  it('handles negative durations with a leading minus', () => {
    expect(formatDurationLabel(-30 * 86_400_000)).toBe('-1M');
  });

  it('returns "" for non-finite input', () => {
    expect(formatDurationLabel(NaN)).toBe('');
    expect(formatDurationLabel(Infinity)).toBe('');
  });
});

describe('resolveTimeFormatter — duration preset', () => {
  it('recognises the string literal "duration"', () => {
    const fmt = resolveTimeFormatter('duration');
    expect(fmt).toBeDefined();
    expect(fmt!(30 * 86_400_000)).toBe('1M');
    expect(fmt!(365 * 86_400_000)).toBe('1Y');
  });

  it('still accepts token templates like "YYYY-MM"', () => {
    const fmt = resolveTimeFormatter('YYYY-MM');
    // 2024-03 UTC
    const t = Date.UTC(2024, 2, 15);
    expect(fmt!(t)).toBe('2024-03');
  });

  it('returns undefined for nullish input', () => {
    expect(resolveTimeFormatter(undefined)).toBeUndefined();
  });

  it('passes callbacks through unchanged', () => {
    const cb = (t: number) => `t=${t}`;
    expect(resolveTimeFormatter(cb)).toBe(cb);
  });
});
