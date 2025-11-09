import type { ValidationError } from 'class-validator';

export function compactValidationErrors(
  errors: ValidationError[],
): Array<{ property: string; constraints?: Record<string, string> }> {
  const out: Array<{ property: string; constraints?: Record<string, string> }> =
    [];
  const walk = (err: ValidationError) => {
    out.push({ property: err.property, constraints: err.constraints });
    if (err.children && err.children.length) err.children.forEach(walk);
  };
  errors.forEach(walk);
  return out;
}
