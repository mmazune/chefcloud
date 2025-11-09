#!/usr/bin/env node

/**
 * Export OpenAPI spec to JSON file
 * 
 * Prerequisites:
 * - Database must be running (DATABASE_URL env var)
 * - API must be built (pnpm build)
 * 
 * Usage: DATABASE_URL="postgresql://..." node scripts/export-openapi.js
 * Output: ../../reports/openapi/openapi.json
 */

const { NestFactory } = require('@nestjs/core');
const { SwaggerModule, DocumentBuilder } = require('@nestjs/swagger');
const fs = require('fs');
const path = require('path');

// Validate environment
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  console.error('   Example: DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chefcloud" node scripts/export-openapi.js');
  process.exit(1);
}

async function exportOpenApi() {
  let app;
  try {
    console.log('Loading application...');
    
    // Dynamically import AppModule
    const { AppModule } = require('../dist/src/app.module');
    
    // Create app with minimal config (no logging)
    app = await NestFactory.create(AppModule, {
      logger: false,
    });
    
    // Initialize app (connects to database, etc.)
    await app.init();
    
    // Read version from package.json
    const packageJson = require('../package.json');
    const version = process.env.BUILD_VERSION || packageJson.version || '0.0.0';
    
    console.log(`Building OpenAPI spec (version ${version})...`);
    
    // Build OpenAPI document
    const builder = new DocumentBuilder()
      .setTitle('ChefCloud API')
      .setDescription('Official API specification for ChefCloud')
      .setVersion(version)
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'bearer'
      )
      .addServer(process.env.BASE_URL || 'http://localhost:3001')
      .build();

    const document = SwaggerModule.createDocument(app, builder, {
      deepScanRoutes: true,
    });
    
    // Ensure output directory exists
    const outputDir = path.resolve(__dirname, '../../../reports/openapi');
    const outputFile = path.join(outputDir, 'openapi.json');
    
    fs.mkdirSync(outputDir, { recursive: true });
    
    // Write JSON file
    fs.writeFileSync(outputFile, JSON.stringify(document, null, 2));
    
    console.log(`✅ OpenAPI spec exported to: ${outputFile}`);
    console.log(`   Paths: ${Object.keys(document.paths || {}).length}`);
    console.log(`   Tags: ${(document.tags || []).length}`);
    
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to export OpenAPI spec:', error.message);
    console.error(error.stack);
    if (app) {
      await app.close();
    }
    process.exit(1);
  }
}

exportOpenApi();
