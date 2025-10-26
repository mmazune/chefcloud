import type { NextApiRequest, NextApiResponse } from 'next';
import type { VersionInfo } from '@chefcloud/contracts';

export default function handler(_req: NextApiRequest, res: NextApiResponse<VersionInfo>) {
  res.status(200).json({
    version: '0.1.0',
    buildDate: new Date().toISOString(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
  });
}
