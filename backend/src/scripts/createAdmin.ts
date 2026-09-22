import readline from 'readline';
import { AuthService } from '../services/auth.service.ts';
import { closeDatabaseConnections, getDbPool } from '../db/index.ts';
import { config } from '../config/index.ts';

function promptInput(query: string, hideInput = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (hideInput && process.stdin.isTTY) {
      // In TTY mode, we can suppress echo
      const stdin = process.stdin as any;
      process.stdout.write(query);
      stdin.setRawMode?.(true);
      stdin.resume();

      let input = '';
      const onData = (char: Buffer) => {
        const str = char.toString('utf-8');
        if (str === '\n' || str === '\r' || str === '\u0004') {
          stdin.setRawMode?.(false);
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(input);
        } else if (str === '\u0003') {
          process.exit(1);
        } else if (str === '\b' || str === '\x7f') {
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          input += str;
          process.stdout.write('*');
        }
      };

      stdin.on('data', onData);
    } else {
      rl.question(query, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

function parseArg(flag: string): string | null {
  const args = process.argv.slice(2);
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return null;
}

async function main() {
  console.log('====================================================');
  console.log('Portfolio CMS - Admin Account Creation Utility');
  console.log('====================================================');

  if (!config.databaseUrl) {
    console.error('\n[ERROR] DATABASE_URL is not configured in .env.');
    console.error('Please configure a valid PostgreSQL connection in .env before creating an administrator.');
    process.exit(1);
  }

  const pool = getDbPool();
  if (!pool) {
    console.error('\n[ERROR] Unable to connect to PostgreSQL database.');
    process.exit(1);
  }

  try {
    let name = parseArg('--name');
    let email = parseArg('--email');
    let password = parseArg('--password');

    if (!name) {
      name = await promptInput('Enter Administrator Name: ');
    }
    if (!email) {
      email = await promptInput('Enter Administrator Email: ');
    }
    if (!password) {
      password = await promptInput('Enter Administrator Password: ', true);
    }

    // Input validation
    if (!name || name.trim().length < 2) {
      console.error('\n[ERROR] Administrator name must be at least 2 characters.');
      process.exit(1);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      console.error('\n[ERROR] Please provide a valid email address.');
      process.exit(1);
    }

    if (!password || password.length < 8) {
      console.error('\n[ERROR] Password must be at least 8 characters long for security.');
      process.exit(1);
    }

    console.log('\nCreating administrator account...');
    const user = await AuthService.createAdminUser({
      name,
      email,
      password,
      role: 'admin',
    });

    console.log('\n✓ Administrator account successfully created!');
    console.log(`  ID:    ${user.id}`);
    console.log(`  Name:  ${user.name}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Role:  ${user.role}`);
    console.log('\nPassword has been securely hashed with bcrypt. Plain-text password is never stored.');
    console.log('====================================================');
  } catch (err: any) {
    console.error(`\n[ERROR] Failed to create administrator: ${err?.message || err}`);
    process.exitCode = 1;
  } finally {
    await closeDatabaseConnections();
  }
}

main();
