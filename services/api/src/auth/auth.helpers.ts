import * as argon2 from 'argon2';

export class AuthHelpers {
  static async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: parseInt(process.env.PIN_HASH_MEMORY || '65536', 10),
      timeCost: parseInt(process.env.PIN_HASH_ITER || '3', 10),
    });
  }

  static async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  static async hashPin(pin: string): Promise<string> {
    return this.hashPassword(pin);
  }

  static async verifyPin(hash: string, pin: string): Promise<boolean> {
    return this.verifyPassword(hash, pin);
  }
}
