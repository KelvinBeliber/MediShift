import { Router } from 'express';
import * as roleController from '@controllers/role/role.controller';
import { authenticate } from '@middleware/authenticate';

const router = Router();

router.get('/', authenticate, roleController.getRoles);
router.get('/permissions', authenticate, roleController.getPermissions);

export default router;
