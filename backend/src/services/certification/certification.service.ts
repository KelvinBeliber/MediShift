import { Certification, ICertification } from '@models/Certification.model';
import { ApiError } from '@utils/ApiError';
import { PaginationParams, buildPaginationMeta } from '@utils/pagination';

export async function listCertifications(pagination: PaginationParams) {
  const filter = {};
  const [docs, total] = await Promise.all([
    Certification.find(filter).sort(pagination.sort).skip(pagination.skip).limit(pagination.limit),
    Certification.countDocuments(filter),
  ]);
  return { docs, meta: buildPaginationMeta(pagination.page, pagination.limit, total) };
}

export async function getCertification(id: string): Promise<ICertification> {
  const certification = await Certification.findById(id);
  if (!certification) throw ApiError.notFound('Certification not found');
  return certification;
}

export async function createCertification(data: Partial<ICertification>): Promise<ICertification> {
  const existing = await Certification.findOne({ $or: [{ name: data.name }, { code: data.code }] });
  if (existing) throw ApiError.conflict('A certification with this name or code already exists');
  return Certification.create(data);
}

export async function updateCertification(id: string, data: Partial<ICertification>): Promise<ICertification> {
  if (data.name || data.code) {
    const existing = await Certification.findOne({
      _id: { $ne: id },
      $or: [{ name: data.name }, { code: data.code }],
    });
    if (existing) throw ApiError.conflict('A certification with this name or code already exists');
  }
  const certification = await Certification.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!certification) throw ApiError.notFound('Certification not found');
  return certification;
}

export async function deactivateCertification(id: string): Promise<ICertification> {
  const certification = await Certification.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!certification) throw ApiError.notFound('Certification not found');
  return certification;
}
