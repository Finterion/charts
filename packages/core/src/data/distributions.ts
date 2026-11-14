/** Shared checks for the imperative engine and JSON compiler. Empty groups are valid. */
export function validateDistributionData(kind: 'donut' | 'boxplot', value: unknown): string[] {
  if (!value || typeof value !== 'object') return [`${kind} data must be an object`];
  const data = value as Record<string, unknown>;
  const errors: string[] = [];
  const categories = data.categories;
  const values = data.values;
  if (!Array.isArray(categories) || !categories.every(v => typeof v === 'string')) {
    errors.push('categories must be an array of strings');
  }
  if (!Array.isArray(values)) {
    errors.push('values must be an array');
  } else {
    if (Array.isArray(categories) && values.length !== categories.length) {
      errors.push('values must have one entry per category');
    }
    const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
    if (kind === 'donut') {
      if (!values.every(v => finite(v) && (v as number) >= 0)) {
        errors.push('donut values must be finite non-negative numbers');
      } else if (!Number.isFinite(values.reduce((sum, v) => sum + v, 0))) {
        errors.push('donut total must be finite');
      }
    } else if (!values.every(v => Array.isArray(v) && v.every(finite))) {
      errors.push('boxplot values must be arrays of finite numbers');
    }
  }
  if (data.colors !== undefined && (
    !Array.isArray(data.colors) || !Array.isArray(categories) ||
    data.colors.length !== categories.length ||
    !data.colors.every(v => typeof v === 'string' && v.trim().length > 0)
  )) errors.push('colors must contain one non-empty color per category');
  if (kind === 'donut') {
    if (data.innerRadius !== undefined && (
      typeof data.innerRadius !== 'number' || !Number.isFinite(data.innerRadius) ||
      data.innerRadius <= 0 || data.innerRadius >= 1
    )) errors.push('innerRadius must be strictly between 0 and 1');
    if (data.centerLabel !== undefined && typeof data.centerLabel !== 'string') {
      errors.push('centerLabel must be a string');
    }
    if (data.showTotal !== undefined && typeof data.showTotal !== 'boolean') {
      errors.push('showTotal must be a boolean');
    }
  } else if (data.showPoints !== undefined && typeof data.showPoints !== 'boolean') {
    errors.push('showPoints must be a boolean');
  }
  return errors;
}

export function assertDistributionData(kind: 'donut' | 'boxplot', value: unknown): void {
  const errors = validateDistributionData(kind, value);
  if (errors.length) throw new Error(`Invalid ${kind}: ${errors.join('; ')}`);
}
