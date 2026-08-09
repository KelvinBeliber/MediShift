import { Types } from 'mongoose';
import { Message, IMessage } from '@models/Message.model';
import { ApiError } from '@utils/ApiError';
import { logger } from '@utils/logger';
import { PaginationParams, buildPaginationMeta } from '@utils/pagination';
import { getIO, userRoom, departmentRoom } from '@sockets/index';

interface SendMessageInput {
  sender: string;
  conversationType: 'direct' | 'department';
  recipient?: string;
  department?: string;
  content: string;
  attachments?: string[];
}

export async function sendMessage(data: SendMessageInput): Promise<IMessage> {
  const message = await Message.create(data);
  const populated = await message.populate('sender', 'email');

  try {
    if (data.conversationType === 'direct' && data.recipient) {
      getIO().to(userRoom(data.recipient)).emit('message:new', populated.toJSON());
      getIO().to(userRoom(data.sender)).emit('message:new', populated.toJSON());
    } else if (data.conversationType === 'department' && data.department) {
      getIO().to(departmentRoom(data.department)).emit('message:new', populated.toJSON());
    }
  } catch (error) {
    logger.debug('Socket.io not available to push message in real time', error);
  }

  return populated;
}

export async function getDirectConversation(
  userId: string,
  otherUserId: string,
  pagination: PaginationParams
) {
  const filter = {
    conversationType: 'direct' as const,
    deletedFor: { $ne: userId },
    $or: [
      { sender: userId, recipient: otherUserId },
      { sender: otherUserId, recipient: userId },
    ],
  };

  const [docs, total] = await Promise.all([
    Message.find(filter).populate('sender', 'email').sort(pagination.sort).skip(pagination.skip).limit(pagination.limit),
    Message.countDocuments(filter),
  ]);
  return { docs, meta: buildPaginationMeta(pagination.page, pagination.limit, total) };
}

export async function getDepartmentConversation(departmentId: string, pagination: PaginationParams) {
  const filter = { conversationType: 'department' as const, department: departmentId };

  const [docs, total] = await Promise.all([
    Message.find(filter).populate('sender', 'email').sort(pagination.sort).skip(pagination.skip).limit(pagination.limit),
    Message.countDocuments(filter),
  ]);
  return { docs, meta: buildPaginationMeta(pagination.page, pagination.limit, total) };
}

export async function getDirectInbox(userId: string) {
  const me = new Types.ObjectId(userId);

  const results = await Message.aggregate([
    {
      $match: {
        conversationType: 'direct',
        deletedFor: { $ne: me },
        $or: [{ sender: me }, { recipient: me }],
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $addFields: {
        otherUser: { $cond: [{ $eq: ['$sender', me] }, '$recipient', '$sender'] },
      },
    },
    {
      $group: {
        _id: '$otherUser',
        lastMessage: { $first: '$$ROOT' },
        unreadCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$recipient', me] },
                  { $eq: [{ $size: { $filter: { input: '$readBy', as: 'r', cond: { $eq: ['$$r.user', me] } } } }, 0] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    { $sort: { 'lastMessage.createdAt': -1 } },
  ]);

  await Message.populate(results, [
    { path: '_id', select: 'email', model: 'User' },
    { path: 'lastMessage.sender', select: 'email', model: 'User' },
  ]);

  return results.map((r) => ({
    user: r._id,
    unreadCount: r.unreadCount,
    lastMessage: {
      id: r.lastMessage._id,
      sender: r.lastMessage.sender,
      conversationType: r.lastMessage.conversationType,
      recipient: r.lastMessage.recipient,
      department: r.lastMessage.department,
      content: r.lastMessage.content,
      readBy: r.lastMessage.readBy,
      createdAt: r.lastMessage.createdAt,
    },
  }));
}

export async function markMessageRead(id: string, userId: string): Promise<IMessage> {
  const message = await Message.findById(id);
  if (!message) throw ApiError.notFound('Message not found');

  const alreadyRead = message.readBy.some((r) => r.user.toString() === userId);
  if (!alreadyRead) {
    message.readBy.push({ user: userId as unknown as typeof message.readBy[number]['user'], readAt: new Date() });
    await message.save();
  }
  return message;
}
