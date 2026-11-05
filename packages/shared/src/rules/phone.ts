const EGYPT_CODE = '20';
/**
 * The national number after +20: mobiles are 1[0125] + 8 digits; landlines an area code (2 Cairo,
 * 3 Alexandria, 2-digit others) + 7–8 digits, so 8–10 digits that don't start with 0.
 */
const MOBILE = /^1[0125]\d{8}$/;
const LANDLINE = /^[2-9]\d{7,8}$/;
/** Separators people type inside a phone number, and the LTR/RTL marks pasted with it. */
const SEPARATORS = /[\s\-().\p{Cf}]/gu;

/** Arabic-Indic (U+0660–0669) and Persian (U+06F0–06F9) digits → ASCII. */
const toAsciiDigits = (value: string): string =>
  value.replace(/\p{Nd}/gu, (d) => {
    const code = d.charCodeAt(0);
    const isEastern =
      (code >= 0x0660 && code <= 0x0669) || (code >= 0x06f0 && code <= 0x06f9);
    return isEastern ? String(code & 0xf) : d;
  });

/**
 * An Egyptian phone in international form (`+20…`, business §3), or `null` when it isn't one.
 * Accepts local `010…`, `+20…`, `0020…`, `20…`, a stray trunk zero after the code (`+20 010…`),
 * spaces/dashes/brackets, and Arabic-Indic digits.
 */
export const normalizeEgyptPhone = (input: string): string | null => {
  let value = toAsciiDigits(input.trim()).replace(SEPARATORS, '');
  if (value.startsWith('+')) value = value.slice(1);
  else if (value.startsWith('00')) value = value.slice(2);
  else if (value.startsWith('0')) value = EGYPT_CODE + value.slice(1);
  if (!/^\d+$/.test(value) || !value.startsWith(EGYPT_CODE)) return null;
  let national = value.slice(EGYPT_CODE.length);
  if (national.startsWith('0')) national = national.slice(1);
  return MOBILE.test(national) ||
    (!national.startsWith('1') && LANDLINE.test(national))
    ? `+${EGYPT_CODE}${national}`
    : null;
};
