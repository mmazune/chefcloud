// Mock for @simplewebauthn/server in E2E tests
export const generateRegistrationOptions = jest.fn(async () => ({ 
  rp: { id: 'localhost', name: 'ChefCloud' }, 
  user: { id: 'u', name: 'u', displayName: 'User' }, 
  challenge: 'c',
  pubKeyCredParams: [],
  timeout: 60000,
  attestation: 'none' as const
}));

export const generateAuthenticationOptions = jest.fn(async () => ({ 
  challenge: 'c',
  timeout: 60000,
  rpId: 'localhost'
}));

export const verifyRegistrationResponse = jest.fn(async () => ({
  verified: true,
  registrationInfo: {
    credentialID: Buffer.from('cred-id'),
    credentialPublicKey: Buffer.from('pub-key'),
    counter: 1,
    credentialDeviceType: 'singleDevice' as const,
    credentialBackedUp: false,
    authenticatorAttachment: 'platform' as const
  }
}));

export const verifyAuthenticationResponse = jest.fn(async () => ({
  verified: true,
  authenticationInfo: {
    newCounter: 2,
    credentialID: Buffer.from('cred-id'),
    credentialDeviceType: 'singleDevice' as const,
    credentialBackedUp: false
  }
}));

