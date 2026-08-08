import multer from 'multer';
import { ApiError } from '@utils/ApiError';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const storage = multer.memoryStorage();

export const uploadSingleFile = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype}. Allowed: PDF, DOC/DOCX, JPEG, PNG, WEBP.`));
      return;
    }
    cb(null, true);
  },
}).single('file');
