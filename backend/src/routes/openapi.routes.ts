import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';

const router = Router();

function specPath(): string {
  return path.join(__dirname, '..', '..', 'docs', 'openapi.yaml');
}

function loadSpec(): Record<string, unknown> {
  const raw = fs.readFileSync(specPath(), 'utf8');
  return YAML.parse(raw) as Record<string, unknown>;
}

let cachedSpec: Record<string, unknown> | null = null;

function getSpec(): Record<string, unknown> {
  if (!cachedSpec) {
    cachedSpec = loadSpec();
  }
  return cachedSpec;
}

/** Raw OpenAPI 3 spec (YAML). */
router.get('/openapi.yaml', (_req: Request, res: Response) => {
  res.type('text/yaml; charset=utf-8');
  res.send(fs.readFileSync(specPath(), 'utf8'));
});

/** Swagger UI — assets under /api/docs/ */
router.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(getSpec(), {
    customSiteTitle: 'Pouraccord API',
    customCss: '.swagger-ui .topbar { display: none }',
  })
);

/**
 * Redirection pratique : /api/docs → /api/docs/
 * (évite une 404 si l’URL sans slash final est utilisée)
 */
router.get('/docs', (_req: Request, res: Response, next: NextFunction) => {
  res.redirect(301, '/api/docs/');
});

export default router;
