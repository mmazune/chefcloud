import { Injectable } from '@nestjs/common';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  GenerateRegistrationOptionsOpts,
  GenerateAuthenticationOptionsOpts,
  VerifyRegistrationResponseOpts,
  VerifyAuthenticationResponseOpts,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/types';
import { PrismaService } from '../prisma.service';
import type { User } from '@chefcloud/db';

@Injectable()
export class WebAuthnService {
  private readonly rpName = 'ChefCloud';
  private readonly rpID: string;
  private readonly origin: string;

  constructor(private prisma: PrismaService) {
    this.rpID = process.env.RP_ID || 'localhost';
    this.origin = process.env.ORIGIN || 'http://localhost:5173';
  }

  async generateRegistrationOptions(user: User): Promise<PublicKeyCredentialCreationOptionsJSON> {
    // Get existing credentials for this user
    const userCredentials = await this.prisma.client.webAuthnCredential.findMany({
      where: { userId: user.id },
    });

    const opts: GenerateRegistrationOptionsOpts = {
      rpName: this.rpName,
      rpID: this.rpID,
      userName: user.email,
      userID: Uint8Array.from(Buffer.from(user.id)),
      timeout: 60000,
      attestationType: 'none',
      excludeCredentials: userCredentials.map((cred) => ({
        id: cred.credentialId,
        transports:
          cred.transports.length > 0
            ? (cred.transports as ('ble' | 'hybrid' | 'internal' | 'nfc' | 'usb' | 'smart-card')[])
            : undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    };

    return await generateRegistrationOptions(opts);
  }

  async verifyRegistration(
    user: User,
    response: RegistrationResponseJSON,
    expectedChallenge: string,
  ): Promise<{ verified: boolean; credential?: { id: string } }> {
    const opts: VerifyRegistrationResponseOpts = {
      response,
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
    };

    let verification;
    try {
      verification = await verifyRegistrationResponse(opts);
    } catch (error) {
      console.error('Registration verification failed:', error);
      return { verified: false };
    }

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
      const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo;

      // Store credential in database
      const savedCredential = await this.prisma.client.webAuthnCredential.create({
        data: {
          userId: user.id,
          credentialId: Buffer.from(credential.id).toString('base64url'),
          publicKey: Buffer.from(credential.publicKey),
          counter: credential.counter,
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          transports: response.response.transports || [],
        },
      });

      // Audit event
      await this.prisma.client.auditEvent.create({
        data: {
          branchId: user.branchId || '',
          userId: user.id,
          action: 'webauthn.credential.registered',
          resource: 'webauthn_credentials',
          resourceId: savedCredential.id,
          metadata: {
            deviceType: credentialDeviceType,
            backedUp: credentialBackedUp,
          },
        },
      });

      return { verified: true, credential: savedCredential };
    }

    return { verified: false };
  }

  async generateAuthenticationOptions(
    userId: string,
  ): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const userCredentials = await this.prisma.client.webAuthnCredential.findMany({
      where: { userId },
    });

    const opts: GenerateAuthenticationOptionsOpts = {
      timeout: 60000,
      allowCredentials: userCredentials.map((cred) => ({
        id: cred.credentialId,
        transports:
          cred.transports.length > 0
            ? (cred.transports as ('ble' | 'hybrid' | 'internal' | 'nfc' | 'usb' | 'smart-card')[])
            : undefined,
      })),
      userVerification: 'preferred',
      rpID: this.rpID,
    };

    return await generateAuthenticationOptions(opts);
  }

  async verifyAuthentication(
    response: AuthenticationResponseJSON,
    expectedChallenge: string,
  ): Promise<{ verified: boolean; user?: User }> {
    // Find credential by credentialId
    const credentialId = response.id;
    const credential = await this.prisma.client.webAuthnCredential.findUnique({
      where: { credentialId },
      include: { user: true },
    });

    if (!credential) {
      return { verified: false };
    }

    const opts: VerifyAuthenticationResponseOpts = {
      response,
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
      credential: {
        id: credential.credentialId,
        publicKey: Uint8Array.from(credential.publicKey),
        counter: credential.counter,
        transports:
          credential.transports.length > 0
            ? (credential.transports as (
                | 'ble'
                | 'hybrid'
                | 'internal'
                | 'nfc'
                | 'usb'
                | 'smart-card'
              )[])
            : undefined,
      },
    };

    let verification;
    try {
      verification = await verifyAuthenticationResponse(opts);
    } catch (error) {
      console.error('Authentication verification failed:', error);
      return { verified: false };
    }

    const { verified, authenticationInfo } = verification;

    if (verified) {
      // Update counter
      await this.prisma.client.webAuthnCredential.update({
        where: { id: credential.id },
        data: { counter: authenticationInfo.newCounter },
      });

      // Audit event
      await this.prisma.client.auditEvent.create({
        data: {
          branchId: credential.user.branchId || '',
          userId: credential.user.id,
          action: 'webauthn.authentication.success',
          resource: 'webauthn_credentials',
          resourceId: credential.id,
          metadata: {
            newCounter: authenticationInfo.newCounter,
          },
        },
      });

      return { verified: true, user: credential.user };
    }

    return { verified: false };
  }
}
