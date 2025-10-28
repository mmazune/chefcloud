import { Test, TestingModule } from '@nestjs/testing';
import { WebAuthnService } from './webauthn.service';
import { PrismaService } from '../prisma.service';

jest.mock('@simplewebauthn/server', () => require('./__mocks__/simplewebauthn'));

describe('WebAuthnService', () => {
  let service: WebAuthnService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebAuthnService,
        {
          provide: PrismaService,
          useValue: {
            client: {
              webAuthnCredential: {
                findMany: jest.fn(),
                create: jest.fn(),
                findUnique: jest.fn(),
                update: jest.fn(),
              },
              auditEvent: {
                create: jest.fn(),
              },
            },
          },
        },
      ],
    }).compile();

    service = module.get<WebAuthnService>(WebAuthnService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateRegistrationOptions', () => {
    it('should generate registration options for a user', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'chef@chefcloud.com',
        firstName: 'John',
        lastName: 'Doe',
        roleLevel: 'L3',
        orgId: 'org-1',
        branchId: 'branch-1',
        isActive: true,
        passwordHash: null,
        pinHash: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prisma.client.webAuthnCredential, 'findMany').mockResolvedValue([]);

      const options = await service.generateRegistrationOptions(mockUser as any);

      expect(options).toHaveProperty('challenge');
      expect(options).toHaveProperty('rp');
      expect(options.rp.name).toBe('ChefCloud');
      expect(options.user.name).toBe(mockUser.email);
      // The mock returns a base64url encoded user ID
      expect(options.user.id).toBeDefined();
    });

    it('should exclude existing credentials', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'chef@chefcloud.com',
        firstName: 'John',
        lastName: 'Doe',
        roleLevel: 'L3',
        orgId: 'org-1',
        branchId: 'branch-1',
        isActive: true,
        passwordHash: null,
        pinHash: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const existingCred = {
        id: 'cred-1',
        userId: 'user-1',
        credentialId: 'existing-cred-id',
        publicKey: Buffer.from('public-key'),
        counter: 0,
        deviceType: 'singleDevice',
        backedUp: false,
        transports: ['internal'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest
        .spyOn(prisma.client.webAuthnCredential, 'findMany')
        .mockResolvedValue([existingCred as any]);

      const options = await service.generateRegistrationOptions(mockUser as any);

      expect(options.excludeCredentials).toHaveLength(1);
      expect(options.excludeCredentials?.[0].id).toBe('existing-cred-id');
    });
  });

  describe('generateAuthenticationOptions', () => {
    it('should generate authentication options with allowed credentials', async () => {
      const cred1 = {
        id: 'cred-1',
        userId: 'user-1',
        credentialId: 'cred-id-1',
        publicKey: Buffer.from('key-1'),
        counter: 5,
        deviceType: 'singleDevice',
        backedUp: false,
        transports: ['internal'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prisma.client.webAuthnCredential, 'findMany').mockResolvedValue([cred1 as any]);

      const options = await service.generateAuthenticationOptions('user-1');

      expect(options).toHaveProperty('challenge');
      expect(options.allowCredentials).toHaveLength(1);
      expect(options.allowCredentials?.[0].id).toBe('cred-id-1');
    });
  });
});
