import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
// Relative imports only — globalSetup runs outside Jest's module resolution,
// so the `@alias/*` path mapping used elsewhere in the app isn't available here.
import { Permission } from '../src/models/Permission.model';
import { Role } from '../src/models/Role.model';
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '../src/constants/permissions';

export default async function globalSetup(): Promise<void> {
  process.env.NODE_ENV = 'test';

  const mongod = await MongoMemoryServer.create();
  (global as unknown as { __MONGOD__: MongoMemoryServer }).__MONGOD__ = mongod;
  const uri = mongod.getUri('medishift_test');
  process.env.MONGO_URI_TEST = uri;

  await mongoose.connect(uri);

  // Roles/permissions are reference data shared across the whole test run (see
  // tests/setup.ts, which excludes them from per-test cleanup) — seeded once here.
  const permissionIds = new Map<string, mongoose.Types.ObjectId>();
  for (const key of ALL_PERMISSIONS) {
    const [module] = key.split(':');
    const doc = await Permission.findOneAndUpdate(
      { key },
      { key, module },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    permissionIds.set(key, doc!._id as mongoose.Types.ObjectId);
  }

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

  await mongoose.disconnect();
}
