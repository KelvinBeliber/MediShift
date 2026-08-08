import mongoose from 'mongoose';

// Notifications/messages gracefully no-op when Socket.io isn't running (expected
// in tests) and log a debug line each time — silence that expected noise.
beforeAll(() => {
  jest.spyOn(console, 'debug').mockImplementation(() => undefined);
});

beforeAll(async () => {
  const uri = process.env.MONGO_URI_TEST;
  if (!uri) {
    throw new Error('MONGO_URI_TEST not set — globalSetup did not run correctly');
  }
  await mongoose.connect(uri);
});

// Roles/permissions are seeded once in globalSetup and treated as shared reference
// data for the whole run — every other collection is wiped between tests.
const PRESERVE_BETWEEN_TESTS = new Set(['roles', 'permissions']);

afterEach(async () => {
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.entries(collections)
      .filter(([name]) => !PRESERVE_BETWEEN_TESTS.has(name))
      .map(([, collection]) => collection.deleteMany({}))
  );
});

afterAll(async () => {
  // NOTE: do not drop the database here — this hook runs once per test *file*,
  // but the in-memory MongoDB instance (and its seeded roles/permissions) is
  // shared across every file in the run. globalTeardown stops the whole mongod
  // instance at the very end, which is the actual point of full cleanup.
  await mongoose.disconnect();
});

jest.setTimeout(30000);
