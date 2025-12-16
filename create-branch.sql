-- Create a default branch and update the user
INSERT INTO branches (
    id, "orgId", name, address, 
    timezone, "currencyCode", "createdAt", "updatedAt"
)
VALUES (
    'branch_default_001',
    'org_default_001',
    'Main Branch',
    '123 Main Street, Kampala',
    'Africa/Kampala',
    'UGX',
    NOW(),
    NOW()
);

-- Update admin user to have a branch
UPDATE users 
SET "branchId" = 'branch_default_001',
    "updatedAt" = NOW()
WHERE email = 'admin@local.test';

-- Verify
SELECT 
    u.email, 
    u."roleLevel", 
    b.name as branch_name,
    o.name as org_name
FROM users u
JOIN orgs o ON u."orgId" = o.id
LEFT JOIN branches b ON u."branchId" = b.id
WHERE u.email = 'admin@local.test';
