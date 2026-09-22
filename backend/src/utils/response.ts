import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown;
  environment?: string;
  timestamp?: string;
}

export function sendSuccess<T>(
  res: Response,
  message: string,
  data?: T,
  statusCode = 200,
  extra?: Record<string, unknown>
): Response {
  const responsePayload: ApiResponse<T> & Record<string, unknown> = {
    success: true,
    message,
    ...(data !== undefined ? { data } : {}),
    ...(extra || {}),
  };
  return res.status(statusCode).json(responsePayload);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  errors?: unknown
): Response {
  const responsePayload: ApiResponse = {
    success: false,
    message,
    ...(errors !== undefined ? { errors } : {}),
  };
  return res.status(statusCode).json(responsePayload);
}
