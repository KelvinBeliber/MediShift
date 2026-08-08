import { z } from 'zod';
import { DOCUMENT_TYPE } from '@constants/enums';

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = z.string().regex(objectIdRegex, 'Invalid ID format');

export const uploadDocumentSchema = z.object({
  type: z.enum(DOCUMENT_TYPE),
});

export const employeeIdParamSchema = z.object({ id: objectId });
export const documentIdParamSchema = z.object({ id: objectId });
