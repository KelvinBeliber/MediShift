import { Readable } from 'stream';
import { Document as DocumentModel, IDocument } from '@models/Document.model';
import { Employee } from '@models/Employee.model';
import { cloudinary, isCloudinaryConfigured } from '@config/cloudinary';
import { ApiError } from '@utils/ApiError';
import { DocumentType } from '@constants/enums';

interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
}

function uploadBufferToCloudinary(buffer: Buffer, folder: string): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto' },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error('Cloudinary upload failed with no result'));
          return;
        }
        resolve(result as CloudinaryUploadResult);
      }
    );
    Readable.from(buffer).pipe(uploadStream);
  });
}

export async function uploadDocument(
  employeeId: string,
  type: DocumentType,
  file: UploadedFile,
  uploadedByUserId: string
): Promise<IDocument> {
  if (!isCloudinaryConfigured) {
    throw ApiError.internal(
      'File storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.'
    );
  }

  const employee = await Employee.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');

  const uploadResult = await uploadBufferToCloudinary(file.buffer, `medishift/employees/${employeeId}`);

  const document = await DocumentModel.create({
    owner: employeeId,
    type,
    fileName: file.originalname,
    url: uploadResult.secure_url,
    publicId: uploadResult.public_id,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    uploadedBy: uploadedByUserId,
  });

  employee.documents.push(document._id as typeof employee.documents[number]);
  await employee.save();

  return document;
}

export async function listDocuments(employeeId: string): Promise<IDocument[]> {
  return DocumentModel.find({ owner: employeeId }).sort({ createdAt: -1 });
}

export async function getDocument(id: string): Promise<IDocument> {
  const document = await DocumentModel.findById(id);
  if (!document) throw ApiError.notFound('Document not found');
  return document;
}

export async function deleteDocument(id: string): Promise<void> {
  const document = await DocumentModel.findById(id);
  if (!document) throw ApiError.notFound('Document not found');

  if (isCloudinaryConfigured && document.publicId) {
    await cloudinary.uploader.destroy(document.publicId).catch(() => {
      // Best-effort: proceed with removing our own records even if the
      // remote file was already gone (e.g. manually deleted in Cloudinary).
    });
  }

  await Employee.updateOne({ _id: document.owner }, { $pull: { documents: document._id } });
  await document.deleteOne();
}
