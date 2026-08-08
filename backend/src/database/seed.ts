import { connectDB } from '@config/db';
import { Permission } from '@models/Permission.model';
import { Role } from '@models/Role.model';
import { User } from '@models/User.model';
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '@constants/permissions';
import { ROLES } from '@constants/roles';
import { logger } from '@utils/logger';
import mongoose from 'mongoose';

export async function seedPermissions(): Promise<Map<string, mongoose.Types.ObjectId>> {
  const keyToId = new Map<string, mongoose.Types.ObjectId>();

  for (const key of ALL_PERMISSIONS) {
    const [module] = key.split(':');
    const doc = await Permission.findOneAndUpdate(
      { key },
      { key, module },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    keyToId.set(key, doc._id as mongoose.Types.ObjectId);
  }

  logger.info(`Seeded ${keyToId.size} permissions`);
  return keyToId;
}

export async function seedRoles(permissionIds: Map<string, mongoose.Types.ObjectId>): Promise<void> {
  for (const [roleName, permissionKeys] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const permissionObjectIds = permissionKeys
      .map((key) => permissionIds.get(key))
      .filter((id): id is mongoose.Types.ObjectId => Boolean(id));

    await Role.findOneAndUpdate(
      { name: roleName },
      { name: roleName, permissions: permissionObjectIds, isSystemRole: true },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
  }

  logger.info(`Seeded ${Object.keys(DEFAULT_ROLE_PERMISSIONS).length} roles`);
}

/** Seeds permissions + roles together. Safe to call repeatedly (idempotent upserts). */
export async function seedRolesAndPermissions(): Promise<void> {
  const permissionIds = await seedPermissions();
  await seedRoles(permissionIds);
}

export async function seedSuperAdmin(): Promise<void> {
  const superAdminRole = await Role.findOne({ name: ROLES.SUPER_ADMIN });
  if (!superAdminRole) return;

  const existing = await User.findOne({ role: superAdminRole._id });
  if (existing) {
    logger.info('Super admin already exists — skipping bootstrap user creation');
    return;
  }

  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@medishift.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

  await User.create({
    email,
    password,
    role: superAdminRole._id,
    isEmailVerified: true,
    isActive: true,
  });

  logger.info(`Bootstrap super admin created: ${email} / ${password} — change this password immediately.`);
}

async function run(): Promise<void> {
  await connectDB();
  await seedRolesAndPermissions();
  await seedSuperAdmin();
  await mongoose.disconnect();
  logger.info('Seed complete');
  process.exit(0);
}

// Only auto-run when executed directly (`npm run seed`), never on import —
// this file is also imported by the test suite to seed roles/permissions.
if (require.main === module) {
  run().catch((error) => {
    logger.error('Seed failed', error);
    process.exit(1);
  });
}
