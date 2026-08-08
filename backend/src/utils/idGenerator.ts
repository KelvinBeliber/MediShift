import { SystemSetting } from '@models/SystemSetting.model';

export async function nextSequentialId(counterKey: string, prefix: string, padLength = 6): Promise<string> {
  const setting = await SystemSetting.findOneAndUpdate(
    { key: `counter:${counterKey}` },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  const sequence = Number(setting.value);
  return `${prefix}-${String(sequence).padStart(padLength, '0')}`;
}
