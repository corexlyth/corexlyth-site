// Keep these conditions aligned with Supabase's four required character groups.
export const MIN_PASSWORD_LENGTH = 6;
const gmail = /^[a-z0-9]+(?:\.[a-z0-9]+)*(?:\+[a-z0-9._-]+)?@gmail\.com$/i;
const punctuation = /[\u0021-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u007e]/;

export function normalizeEmail(value: string) { return value.trim().toLowerCase(); }
export function isGmail(value: string) {
  const normalized = normalizeEmail(value);
  return normalized.length <= 254 && (normalized.split('@')[0]?.length ?? 0) <= 64 && gmail.test(normalized);
}
export function passwordChecks(value: string) {
  return [
    { id: 'length', label: 'En az 6 karakter', valid: Array.from(value).length >= MIN_PASSWORD_LENGTH },
    { id: 'upper', label: 'En az 1 büyük harf (A–Z)', valid: /[A-Z]/.test(value) },
    { id: 'lower', label: 'En az 1 küçük harf (a–z)', valid: /[a-z]/.test(value) },
    { id: 'number', label: 'En az 1 rakam (0–9)', valid: /[0-9]/.test(value) },
    { id: 'symbol', label: 'En az 1 noktalama işareti (ör. ! . ? @)', valid: punctuation.test(value) },
  ];
}
export function validPassword(value: string) { return passwordChecks(value).every(check => check.valid); }
