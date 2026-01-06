/**
 * Re-export from e2e-bootstrap for backwards compatibility.
 * Some test files import from ../helpers/module instead of ../helpers/e2e-bootstrap.
 */
export {
  createE2ETestingModule,
  createE2ETestingModuleBuilder,
  createE2EApp,
} from './e2e-bootstrap';
