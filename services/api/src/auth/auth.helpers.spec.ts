import { AuthHelpers } from './auth.helpers';

describe('AuthHelpers', () => {
  describe('hashPassword and verifyPassword', () => {
    it('should hash a password', async () => {
      const password = 'MySecurePassword123!';
      const hash = await AuthHelpers.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash).toContain('$argon2id$');
    });

    it('should verify a correct password', async () => {
      const password = 'MySecurePassword123!';
      const hash = await AuthHelpers.hashPassword(password);

      const isValid = await AuthHelpers.verifyPassword(hash, password);
      expect(isValid).toBe(true);
    });

    it('should reject an incorrect password', async () => {
      const password = 'MySecurePassword123!';
      const wrongPassword = 'WrongPassword456!';
      const hash = await AuthHelpers.hashPassword(password);

      const isValid = await AuthHelpers.verifyPassword(hash, wrongPassword);
      expect(isValid).toBe(false);
    });

    it('should create different hashes for the same password', async () => {
      const password = 'MySecurePassword123!';
      const hash1 = await AuthHelpers.hashPassword(password);
      const hash2 = await AuthHelpers.hashPassword(password);

      expect(hash1).not.toBe(hash2);
      // But both should verify correctly
      expect(await AuthHelpers.verifyPassword(hash1, password)).toBe(true);
      expect(await AuthHelpers.verifyPassword(hash2, password)).toBe(true);
    });
  });

  describe('hashPin and verifyPin', () => {
    it('should hash a PIN', async () => {
      const pin = '1234';
      const hash = await AuthHelpers.hashPin(pin);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(pin);
      expect(hash).toContain('$argon2id$');
    });

    it('should verify a correct PIN', async () => {
      const pin = '1234';
      const hash = await AuthHelpers.hashPin(pin);

      const isValid = await AuthHelpers.verifyPin(hash, pin);
      expect(isValid).toBe(true);
    });

    it('should reject an incorrect PIN', async () => {
      const pin = '1234';
      const wrongPin = '5678';
      const hash = await AuthHelpers.hashPin(pin);

      const isValid = await AuthHelpers.verifyPin(hash, wrongPin);
      expect(isValid).toBe(false);
    });

    it('should handle 6-digit PINs', async () => {
      const pin = '123456';
      const hash = await AuthHelpers.hashPin(pin);
      
      const isValid = await AuthHelpers.verifyPin(hash, pin);
      expect(isValid).toBe(true);
    });
  });
});
