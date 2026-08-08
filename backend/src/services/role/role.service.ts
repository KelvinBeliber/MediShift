import { Role } from '@models/Role.model';
import { Permission } from '@models/Permission.model';

export async function listRoles() {
  return Role.find().populate('permissions').sort({ name: 1 });
}

export async function listPermissions() {
  return Permission.find().sort({ module: 1, key: 1 });
}
