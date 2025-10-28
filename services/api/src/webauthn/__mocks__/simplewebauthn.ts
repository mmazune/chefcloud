export const verifyRegistrationResponse = jest.fn(async () => ({
  verified: true,
  registrationInfo: {
    credentialID: Buffer.from('cred-id'),
    credentialPublicKey: Buffer.from('pub-key'),
    counter: 1,
    credentialDeviceType: 'singleDevice',
    credentialBackedUp: false,
    authenticatorAttachment: 'platform',
  },
}));

export const verifyAuthenticationResponse = jest.fn(async () => ({
  verified: true,
  authenticationInfo: {
    newCounter: 2,
    credentialID: Buffer.from('cred-id'),
    credentialDeviceType: 'singleDevice',
    credentialBackedUp: false,
  },
}));

export const generateRegistrationOptions = jest.fn(async (options) => ({
  challenge: 'test-challenge',
  rp: { name: options.rpName || 'ChefCloud', id: options.rpID || 'localhost' },
  user: {
    id: options.userID ? Buffer.from(options.userID).toString('base64url') : 'test-user-id',
    name: options.userName || 'test@example.com',
    displayName: options.userName || 'Test User',
  },
  pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
  timeout: options.timeout || 60000,
  attestation: options.attestationType || 'none',
  excludeCredentials: options.excludeCredentials || [],
  authenticatorSelection: options.authenticatorSelection || {
    residentKey: 'preferred',
    userVerification: 'preferred',
  },
}));

export const generateAuthenticationOptions = jest.fn(async (options) => ({
  challenge: 'test-auth-challenge',
  rpId: options.rpID || 'localhost',
  allowCredentials: options.allowCredentials || [],
  timeout: 60000,
  userVerification: 'preferred',
}));
