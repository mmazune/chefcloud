/**
 * JWT Token Generation Smoke Test
 *
 * Proves that JWT_SECRET is properly configured in E2E environment
 * and that JwtService can sign/verify tokens.
 */
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { createE2EApp } from '../helpers/e2e-bootstrap';
import { cleanup } from '../helpers/cleanup';

describe('JWT E2E Smoke Test', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    app = await createE2EApp({ imports: [AppModule] });
    jwtService = app.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await cleanup(app);
  });

  it('should sign and verify JWT tokens', () => {
    const payload = {
      sub: 'test-user-id',
      email: 'test@example.com',
      role: 'L5',
    };

    // Sign a token
    const token = jwtService.sign(payload);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts

    // Verify the token
    const decoded = jwtService.verify(token);
    expect(decoded).toBeDefined();
    expect(decoded.sub).toBe('test-user-id');
    expect(decoded.email).toBe('test@example.com');
    expect(decoded.role).toBe('L5');
  });

  it('should reject invalid tokens', () => {
    expect(() => {
      jwtService.verify('invalid.token.here');
    }).toThrow();
  });
});
