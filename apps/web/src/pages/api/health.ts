import type { NextApiRequest, NextApiResponse } from 'next';
import type { HealthResponse } from '@chefcloud/contracts';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse>
) {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  });
}
