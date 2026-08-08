import { connectDB } from '@config/db';
import { Role } from '@models/Role.model';
import { User } from '@models/User.model';
import { ROLE_NAMES } from '@constants/roles';
import { logger } from '@utils/logger';
import mongoose from 'mongoose';

const PASSWORD = 'TestPass123!';

/** Dev-only helper: one login per role, for exercising permission-gated UI locally. Not run in CI or prod. */
async function run(): Promise<void> {
  await connectDB();

  for (const roleName of ROLE_NAMES) {
    const role = await Role.findOne({ name: roleName });
    if (!role) {
      logger.warn(`Role "${roleName}" not seeded — run "npm run seed" first`);
      continue;
    }

    const email = `${roleName}@medishift.local`;
    const existing = await User.findOne({ email });
    if (existing) {
      logger.info(`${email} already exists — skipping`);
      continue;
    }

    await User.create({
      email,
      password: PASSWORD,
      firstName: roleName
        .split('_')
        .map((w) => w[0]!.toUpperCase() + w.slice(1))
        .join(' '),
      lastName: 'Test',
      role: role._id,
      isEmailVerified: true,
      isActive: true,
    });
    logger.info(`Created ${email} / ${PASSWORD}`);
  }

  await mongoose.disconnect();
  logger.info('Done');
  process.exit(0);
}

run().catch((error) => {
  logger.error('seedTestUsers failed', error);
  process.exit(1);
});
