import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';
import { errorResponse } from '../utils/response';

const storage = multer.memoryStorage();

const uploadMiddleware = multer({
  storage,
  limits: { fileSize: config.upload.maxFileSizeMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!config.upload.allowedMimeTypes.includes(file.mimetype)) {
      cb(new Error('FORMAT_NOT_SUPPORTED'));
      return;
    }
    cb(null, true);
  },
}).single('file');

export function handleUpload(req: Request, res: Response, next: NextFunction): void {
  uploadMiddleware(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        errorResponse(res, 'Fichier trop volumineux (max 5 Mo)', ['FILE_TOO_LARGE'], 400);
        return;
      }
      errorResponse(res, err.message, ['UPLOAD_ERROR'], 400);
      return;
    }
    if (err) {
      errorResponse(res, 'Format non supporte (PDF, JPG, PNG)', ['FORMAT_NOT_SUPPORTED'], 400);
      return;
    }
    next();
  });
}
