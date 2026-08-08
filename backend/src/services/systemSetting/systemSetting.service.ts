import { SystemSetting, ISystemSetting } from '@models/SystemSetting.model';
import { ApiError } from '@utils/ApiError';

// Keys under this prefix are internal (e.g. sequential-ID counters used by
// idGenerator.ts) and must never be exposed or mutated through the settings API.
const INTERNAL_KEY_PREFIX = 'counter:';

function assertNotInternal(key: string): void {
  if (key.startsWith(INTERNAL_KEY_PREFIX)) {
    throw ApiError.forbidden('This key is internal and cannot be managed through the settings API');
  }
}

export async function listSettings(): Promise<ISystemSetting[]> {
  return SystemSetting.find({ key: { $not: new RegExp(`^${INTERNAL_KEY_PREFIX}`) } }).sort({ key: 1 });
}

export async function getSetting(key: string): Promise<ISystemSetting> {
  assertNotInternal(key);
  const setting = await SystemSetting.findOne({ key });
  if (!setting) throw ApiError.notFound(`Setting "${key}" not found`);
  return setting;
}

export async function upsertSetting(
  key: string,
  data: { value: unknown; description?: string },
  updatedBy: string
): Promise<ISystemSetting> {
  assertNotInternal(key);
  return SystemSetting.findOneAndUpdate(
    { key },
    { $set: { value: data.value, description: data.description, updatedBy } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function deleteSetting(key: string): Promise<void> {
  assertNotInternal(key);
  const result = await SystemSetting.deleteOne({ key });
  if (result.deletedCount === 0) throw ApiError.notFound(`Setting "${key}" not found`);
}
