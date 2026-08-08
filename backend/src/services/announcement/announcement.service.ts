import { Announcement, IAnnouncement } from '@models/Announcement.model';
import { Employee } from '@models/Employee.model';
import { User } from '@models/User.model';
import { ApiError } from '@utils/ApiError';
import { logger } from '@utils/logger';
import { PaginationParams, buildPaginationMeta } from '@utils/pagination';
import { createNotification, notifyDepartment } from '@services/notifications/notification.service';

interface CreateAnnouncementInput {
  title: string;
  body: string;
  scope: IAnnouncement['scope'];
  department?: string;
  priority?: IAnnouncement['priority'];
  expiresAt?: Date;
  author: string;
}

export async function createAnnouncement(data: CreateAnnouncementInput): Promise<IAnnouncement> {
  const announcement = await Announcement.create(data);

  const notify =
    data.scope === 'department' && data.department
      ? notifyDepartment(data.department, {
          type: 'announcement',
          title: `Announcement: ${announcement.title}`,
          message: announcement.body,
          relatedEntityType: 'Announcement',
          relatedEntityId: announcement.id,
        })
      : User.find({ isActive: true })
          .select('_id')
          .then((users) =>
            Promise.all(
              users.map((u) =>
                createNotification({
                  recipient: u.id,
                  type: 'announcement',
                  title: `Announcement: ${announcement.title}`,
                  message: announcement.body,
                  relatedEntityType: 'Announcement',
                  relatedEntityId: announcement.id,
                })
              )
            )
          );

  notify.catch((error) => logger.error('Failed to send announcement notifications', error));

  return announcement;
}

interface VisibilityScope {
  canManage: boolean;
  employeeDepartment?: string;
}

function buildVisibilityFilter(scope: VisibilityScope): Record<string, unknown> {
  if (scope.canManage) return {};
  const or: Record<string, unknown>[] = [{ scope: 'hospital' }];
  if (scope.employeeDepartment) {
    or.push({ scope: 'department', department: scope.employeeDepartment });
  }
  return { $or: or };
}

export async function listAnnouncements(
  visibility: VisibilityScope,
  filters: { priority?: string },
  pagination: PaginationParams
) {
  const filter: Record<string, unknown> = { isActive: true, ...buildVisibilityFilter(visibility) };
  if (filters.priority) filter.priority = filters.priority;

  const [docs, total] = await Promise.all([
    Announcement.find(filter)
      .populate('author', 'email')
      .populate('department', 'name code')
      .sort(pagination.sort)
      .skip(pagination.skip)
      .limit(pagination.limit),
    Announcement.countDocuments(filter),
  ]);
  return { docs, meta: buildPaginationMeta(pagination.page, pagination.limit, total) };
}

export async function getAnnouncement(id: string): Promise<IAnnouncement> {
  const announcement = await Announcement.findById(id).populate('author', 'email').populate('department', 'name code');
  if (!announcement) throw ApiError.notFound('Announcement not found');
  return announcement;
}

export async function updateAnnouncement(id: string, data: Partial<IAnnouncement>): Promise<IAnnouncement> {
  const announcement = await Announcement.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!announcement) throw ApiError.notFound('Announcement not found');
  return announcement;
}

export async function deactivateAnnouncement(id: string): Promise<IAnnouncement> {
  const announcement = await Announcement.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!announcement) throw ApiError.notFound('Announcement not found');
  return announcement;
}

export async function resolveEmployeeDepartment(employeeId?: string): Promise<string | undefined> {
  if (!employeeId) return undefined;
  const employee = await Employee.findById(employeeId).select('department');
  return employee?.department?.toString();
}
