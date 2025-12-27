/**
 * @file Validation Error
 * @description Error class for validation failures (400 Bad Request)
 *
 * @author AgroBridge Engineering Team
 */

import { AppError } from "./AppError.js";

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
    this.name = "ValidationError";
  }
}
