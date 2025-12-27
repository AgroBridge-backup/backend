import { IUserRepository } from "../../../domain/repositories/IUserRepository.js";
import {
  RegisterRequestDto,
  RegisterResponseDto,
} from "../../dtos/auth.dtos.js";
import { ValidationError } from "../../../shared/errors/ValidationError.js";
import logger from "../../../shared/utils/logger.js";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const BCRYPT_SALT_ROUNDS = 12;

/**
 * RegisterUseCase
 *
 * Handles user registration with:
 * - Email validation (unique check)
 * - Password hashing
 * - User creation
 *
 * @author AgroBridge Engineering Team
 */
export class RegisterUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(dto: RegisterRequestDto): Promise<RegisterResponseDto> {
    const {
      email,
      password,
      firstName,
      lastName,
      businessName,
      rfc,
      state,
      municipality,
    } = dto;
    logger.debug(`[RegisterUseCase] Attempting to register user: ${email}`);

    // 1. Check if email already exists
    const existingUser = await this.userRepository.findByEmail(
      email.toLowerCase().trim(),
    );
    if (existingUser) {
      logger.warn(
        `[RegisterUseCase] Registration failed - email already exists: ${email}`,
      );
      throw new ValidationError("Este correo electrónico ya está registrado");
    }

    // 2. Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // 3. Create user
    const userId = randomUUID();
    const now = new Date();

    const user = await this.userRepository.create({
      id: userId,
      email: email.toLowerCase().trim(),
      passwordHash,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role: "PRODUCER", // Default role for new registrations
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    logger.info(`[RegisterUseCase] User registered successfully: ${user.id}`);

    return {
      userId: user.id,
      email: user.email,
      message:
        "Cuenta creada exitosamente. Por favor verifica tu correo electr\u00f3nico.",
    };
  }
}
