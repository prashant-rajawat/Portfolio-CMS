import { AppError } from '../middleware/errorHandler.ts';

export class NotFoundError extends AppError {
  constructor(message = 'Record not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists with conflicting unique value') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Invalid request parameters') {
    super(message, 400);
    this.name = 'BadRequestError';
  }
}

export class DatabaseNotConfiguredError extends AppError {
  constructor(message = 'Database connection is not configured or unavailable.') {
    super(message, 503);
    this.name = 'DatabaseNotConfiguredError';
  }
}
