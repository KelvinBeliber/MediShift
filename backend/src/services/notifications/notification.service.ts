import { Notification, INotification } from '@models/Notification.model';
import { Employee } from '@models/Employee.model';
import { ApiError } from '@utils/ApiError';
import { PaginationParams, buildPaginationMeta } from '@utils/pagination';
import { logger } from '@utils/logger';
import { getIO, userRoom } from '@sockets/index';
import { NotificationType, NotificationChannel } from '@constants/enums';

interface CreateNotificationInput {
  recipient: string;
  type: NotificationType;
  title: string;
  message: string;
  channels?: NotificationChannel[];
  relatedEntityType?: string;
  relatedEntityId?: string;
  actionUrl?: string;
}

export async function createNotification(input: CreateNotificationInput): Promise<INotification> {
  const notification = await Notification.create({
    recipient: input.recipient,
    type: input.type,
    title: input.title,
    message: input.message,
    channels: input.channels ?? ['in_app'],
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    actionUrl: input.actionUrl,
  });

  try {
    getIO().to(userRoom(input.recipient)).emit('notification', notification.toJSON());
  } catch (error) {
    logger.debug('Socket.io not available to push notification in real time', error);
  }

  return notification;
}

/** Resolves an Employee's linked User account so domain events (leave, swaps, schedules) can notify them. */
export async function notifyEmployee(
  employeeId: string,
  data: Omit<CreateNotificationInput, 'recipient'>
): Promise<INotification | null> {
  const employee = await Employee.findById(employeeId).select('user');
  if (!employee?.user) return null;
  return createNotification({ ...data, recipient: employee.user.toString() });
}

export async function notifyDepartment(
  departmentId: string,
  data: Omit<CreateNotificationInput, 'recipient'>
): Promise<void> {
  const employees = await Employee.find({ department: departmentId, status: 'active' }).select('user');
  await Promise.all(
    employees
      .filter((e) => e.user)
      .map((e) => createNotification({ ...data, recipient: e.user!.toString() }))
  );
}

interface NotificationFilters {
  isRead?: boolean;
}

export async function listNotifications(recipientUserId: string, filters: NotificationFilters, pagination: PaginationParams) {
  const filter: Record<string, unknown> = { recipient: recipientUserId };
  if (filters.isRead !== undefined) filter.isRead = filters.isRead;

  const [docs, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort(pagination.sort).skip(pagination.skip).limit(pagination.limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: recipientUserId, isRead: false }),
  ]);

  return { docs, meta: buildPaginationMeta(pagination.page, pagination.limit, total), unreadCount };
}

export async function markAsRead(id: string, recipientUserId: string): Promise<INotification> {
  const notification = await Notification.findOne({ _id: id, recipient: recipientUserId });
  if (!notification) throw ApiError.notFound('Notification not found');
  notification.isRead = true;
  notification.readAt = new Date();
  await notification.save();
  return notification;
}

export async function markAllAsRead(recipientUserId: string): Promise<{ modifiedCount: number }> {
  const result = await Notification.updateMany(
    { recipient: recipientUserId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return { modifiedCount: result.modifiedCount };
}
