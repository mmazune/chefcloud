import { Controller, Get } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';

function readPkgVersion(): string {
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw);
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

@Controller()
export class VersionController {
  @Get('/version')
  getVersion() {
    const version = process.env.BUILD_VERSION || readPkgVersion();
    const commit = process.env.BUILD_SHA || 'unknown';
    const builtAt = process.env.BUILD_DATE || 'unknown';
    const node = process.version;
    const env = process.env.NODE_ENV || 'development';
    return { version, commit, builtAt, node, env };
  }
}
