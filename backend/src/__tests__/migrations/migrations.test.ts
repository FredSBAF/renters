/**
 * SETUP-03 : Vérification que les migrations BDD existent et créent les tables attendues.
 * Les migrations réelles sont exécutées via `npm run migrate` (Sequelize CLI).
 */
import fs from 'fs';
import path from 'path';

const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', '..', 'migrations');

const EXPECTED_TABLES = ['agencies', 'users', 'refresh_tokens', 'email_verification_tokens'];

describe('SETUP-03 Migrations BDD', () => {
  test('migrations directory exists', () => {
    expect(fs.existsSync(MIGRATIONS_DIR)).toBe(true);
  });

  test('all expected migration files exist and create the right tables', () => {
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.js'));
    expect(files.length).toBeGreaterThanOrEqual(EXPECTED_TABLES.length);

    for (const table of EXPECTED_TABLES) {
      const match = files.find(
        (f) =>
          f.includes(`create-${table.replace(/_/g, '-')}`) ||
          f.includes(`-${table}.js`)
      );
      expect(match).toBeDefined();
      const content = fs.readFileSync(path.join(MIGRATIONS_DIR, match!), 'utf8');
      expect(content).toContain(`createTable('${table}'`);
      expect(content).toContain('async up(queryInterface');
      expect(content).toContain('async down(queryInterface');
    }
  });

  test('migrations run in correct order (agencies before users, users before refresh_tokens and email_verification_tokens)', () => {
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.js'))
      .sort();
    const createAgencies = files.find((f) => f.includes('create-agencies'));
    const createUsers = files.find((f) => f.includes('create-users'));
    const createRefreshTokens = files.find((f) => f.includes('create-refresh-tokens'));
    const createEmailVerification = files.find((f) =>
      f.includes('create-email-verification-tokens')
    );
    expect(createAgencies).toBeDefined();
    expect(createUsers).toBeDefined();
    expect(createRefreshTokens).toBeDefined();
    expect(createEmailVerification).toBeDefined();
    expect(files.indexOf(createAgencies!)).toBeLessThan(files.indexOf(createUsers!));
    expect(files.indexOf(createUsers!)).toBeLessThan(files.indexOf(createRefreshTokens!));
    expect(files.indexOf(createUsers!)).toBeLessThan(files.indexOf(createEmailVerification!));
  });
});
