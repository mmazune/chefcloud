import { isPanLike, parseBadgeCode } from './auth.service';

describe('MSR Badge Security', () => {
  describe('isPanLike', () => {
    it('should detect Track 2 format (;digits=)', () => {
      expect(isPanLike(';1234567890123456=')).toBe(true);
      expect(isPanLike(';4111111111111111=2512')).toBe(true);
      expect(isPanLike('1234567890123456=')).toBe(true); // without leading ;
    });

    it('should detect Track 1 format (%Bdigits^)', () => {
      expect(isPanLike('%B1234567890123456^')).toBe(true);
      expect(isPanLike('%B4111111111111111^DOE/JOHN^')).toBe(true);
    });

    it('should reject valid badge formats', () => {
      expect(isPanLike('CLOUDBADGE:W001')).toBe(false);
      expect(isPanLike('CLOUDBADGE:MGR-123')).toBe(false);
      expect(isPanLike('BADGE123')).toBe(false);
    });

    it('should reject short digit sequences', () => {
      expect(isPanLike(';12345678901=')).toBe(false); // only 11 digits
      expect(isPanLike('%B12345678901^')).toBe(false); // only 11 digits
    });

    it('should detect 19-digit PANs', () => {
      expect(isPanLike(';1234567890123456789=')).toBe(true);
      expect(isPanLike('%B1234567890123456789^')).toBe(true);
    });
  });

  describe('parseBadgeCode', () => {
    it('should parse valid CLOUDBADGE format', () => {
      expect(parseBadgeCode('CLOUDBADGE:W001')).toBe('W001');
      expect(parseBadgeCode('CLOUDBADGE:MGR-123')).toBe('MGR-123');
      expect(parseBadgeCode('CLOUDBADGE:CHEF_01')).toBe('CHEF_01');
    });

    it('should reject invalid formats', () => {
      expect(parseBadgeCode('W001')).toBeNull();
      expect(parseBadgeCode('BADGE:W001')).toBeNull();
      expect(parseBadgeCode('CLOUDBADGE:')).toBeNull();
      expect(parseBadgeCode('CLOUDBADGE:W 001')).toBeNull(); // space not allowed
      expect(parseBadgeCode('CLOUDBADGE:W@001')).toBeNull(); // special char not allowed
    });

    it('should accept alphanumeric with underscore and hyphen', () => {
      expect(parseBadgeCode('CLOUDBADGE:ABC-123_XYZ')).toBe('ABC-123_XYZ');
      expect(parseBadgeCode('CLOUDBADGE:12345')).toBe('12345');
      expect(parseBadgeCode('CLOUDBADGE:ABCDEF')).toBe('ABCDEF');
    });
  });
});
