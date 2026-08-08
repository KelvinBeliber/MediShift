import { Position, IPosition } from '@models/Position.model';
import { ApiError } from '@utils/ApiError';
import { PaginationParams, buildPaginationMeta } from '@utils/pagination';

export async function listPositions(pagination: PaginationParams) {
  const filter = {};
  const [docs, total] = await Promise.all([
    Position.find(filter).populate('requiredCertifications', 'name code').sort(pagination.sort).skip(pagination.skip).limit(pagination.limit),
    Position.countDocuments(filter),
  ]);
  return { docs, meta: buildPaginationMeta(pagination.page, pagination.limit, total) };
}

export async function getPosition(id: string): Promise<IPosition> {
  const position = await Position.findById(id).populate('requiredCertifications', 'name code');
  if (!position) throw ApiError.notFound('Position not found');
  return position;
}

export async function createPosition(data: Partial<IPosition>): Promise<IPosition> {
  const existing = await Position.findOne({ title: data.title });
  if (existing) throw ApiError.conflict('A position with this title already exists');
  return Position.create(data);
}

export async function updatePosition(id: string, data: Partial<IPosition>): Promise<IPosition> {
  if (data.title) {
    const existing = await Position.findOne({ title: data.title, _id: { $ne: id } });
    if (existing) throw ApiError.conflict('A position with this title already exists');
  }
  const position = await Position.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!position) throw ApiError.notFound('Position not found');
  return position;
}

export async function deactivatePosition(id: string): Promise<IPosition> {
  const position = await Position.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!position) throw ApiError.notFound('Position not found');
  return position;
}
