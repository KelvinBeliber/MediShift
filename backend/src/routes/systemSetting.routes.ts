import { Router } from 'express';
import * as systemSettingController from '@controllers/systemSetting/systemSetting.controller';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import { validateRequest } from '@middleware/validateRequest';
import { PERMISSIONS } from '@constants/permissions';
import { upsertSettingSchema, settingKeyParamSchema } from '@validators/systemSetting.validator';

const router = Router();

router.use(authenticate);
router.use(authorize(PERMISSIONS.SYSTEM_SETTINGS_MANAGE));

router.get('/', systemSettingController.getSettings);

router.get('/:key', validateRequest({ params: settingKeyParamSchema }), systemSettingController.getSetting);

router.put(
  '/:key',
  validateRequest({ params: settingKeyParamSchema, body: upsertSettingSchema }),
  systemSettingController.upsertSetting
);

router.delete('/:key', validateRequest({ params: settingKeyParamSchema }), systemSettingController.deleteSetting);

export default router;
