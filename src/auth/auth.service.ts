import {
  Injectable,
  UnauthorizedException,
  Inject,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClientProxy } from '@nestjs/microservices';
import * as bcrypt from 'bcryptjs';

import { envs } from 'config';

import {
  ValidationException,
  DuplicateEntityException,
  EntityNotFoundException,
} from '../common';
import { LoginDto, RefreshTokenDto } from './dto/login-auth.dto';
import { RegisterClientDto } from './dto/register-client.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { UserPayload, AuthResponse } from './entities/user.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private refreshTokens: Map<string, string> = new Map();

  constructor(
    private readonly jwtService: JwtService,
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
  ) {}

  async registerUser(registerDto: RegisterUserDto): Promise<AuthResponse> {
    const errors: Record<string, string[]> = {};

    if (!registerDto.name) {
      errors.name = ['Field name is required'];
    }
    if (!registerDto.email) {
      errors.email = ['Field email is required'];
    }
    if (!registerDto.password) {
      errors.password = ['Field password is required'];
    }
    if (!registerDto.role) {
      errors.role = ['Field role is required'];
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationException('Validation failed', errors);
    }

    const { password } = registerDto;

    const hashedPassword = await bcrypt.hash(password, 10);

    // Preparar el payload completo ANTES de enviarlo
    const userPayload = {
      name: registerDto.name,
      email: registerDto.email,
      password: hashedPassword,
      role: registerDto.role,
    };

    try {
      const createdUser = await this.userClient
        .send('createUser', userPayload)
        .toPromise();

      const tokens = await this.generateTokens({
        sub: createdUser.id,
        email: createdUser.email,
        name: registerDto.name,
      });

      return {
        user: {
          id: createdUser.id,
          email: createdUser.email,
          name: registerDto.name,
          isActive: true,
          createdAt: createdUser.created_at,
          updatedAt: createdUser.updated_at,
        },
        ...tokens,
      };
    } catch (error) {
      this.logger.error('Error creating user in user-ms:', error);

      if (
        error?.message?.includes('already exists') ||
        error?.message?.includes('duplicate')
      ) {
        throw new DuplicateEntityException('User', 'email', registerDto.email);
      }

      throw new ValidationException(
        `Error creating user: ${error.message}. Please try again.`,
      );
    }
  }

  async registerClient(registerDto: RegisterClientDto): Promise<AuthResponse> {
    try {
      const createdClient = await this.userClient
        .send('createClient', {
          name: registerDto.name,
          description: registerDto.description,
          email: registerDto.email,
          password: registerDto.password,
        })
        .toPromise();

      const tokens = await this.generateTokens({
        sub: createdClient.id,
        email: createdClient.email || createdClient.name,
        name: createdClient.name,
      });

      return {
        user: {
          id: createdClient.id,
          email: createdClient.email || createdClient.name,
          name: createdClient.name,
          isActive: true,
          createdAt: createdClient.created_at,
          updatedAt: createdClient.updated_at,
        },
        ...tokens,
      };
    } catch (error) {
      this.logger.error('Error creating client in user-ms:', error);

      if (
        error?.message?.includes('already exists') ||
        error?.message?.includes('duplicate')
      ) {
        throw new DuplicateEntityException('Client', 'name', registerDto.name);
      }

      throw new ValidationException(
        `Error creating client: ${error.message}. Please try again.`,
      );
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;

    try {
      // 1. Buscar primero en usuarios
      let userData = await this.userClient
        .send('findUserByEmail', email)
        .toPromise();

      let userType = 'user';

      // 2. Si no existe, buscar en clientes
      if (!userData) {
        try {
          userData = await this.userClient
            .send('findClientByEmail', email)
            .toPromise();
          userType = 'client';
        } catch (error) {
          this.logger.error(
            `Error finding client by email: ${error.message}`,
            error.stack,
          );
          // Cliente no encontrado, continuar con error genérico
        }
      }

      if (!userData) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // 3. Verificar contraseña (solo si existe)
      if (userData.password) {
        const ok = await bcrypt.compare(password, userData.password);
        if (!ok) {
          throw new UnauthorizedException('Invalid credentials');
        }
      } else {
        // Client without password - allow login (for cases where password is not required)
        this.logger.log('Client without password, allowing login');
      }

      const tokens = await this.generateTokens({
        sub: userData.id,
        email: userData.email || userData.name,
        name: userData.name,
      });

      this.logger.log(`Successful login for ${userType}:`, {
        id: userData.id,
        email: userData.email || userData.name,
      });

      return {
        user: {
          id: userData.id,
          email: userData.email || userData.name,
          name: userData.name,
          isActive: true,
          createdAt: userData.created_at,
          updatedAt: userData.updated_at,
        },
        ...tokens,
      };
    } catch (error) {
      this.logger.error('Error during login:', error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Error authenticating user');
    }
  }

  async refreshToken(
    refreshTokenDto: RefreshTokenDto,
  ): Promise<{ accessToken: string }> {
    const { refreshToken } = refreshTokenDto;
    const userId = this.refreshTokens.get(refreshToken);
    if (!userId) throw new UnauthorizedException('Invalid refresh token');

    try {
      // 1. Buscar primero en usuarios
      let userData = await this.userClient
        .send('findUserById', userId)
        .toPromise();

      // 2. Si no existe, buscar en clientes
      if (!userData) {
        try {
          userData = await this.userClient
            .send('findClientById', userId)
            .toPromise();
        } catch (error) {
          this.logger.error(
            `Error finding client by id: ${error.message}`,
            error.stack,
          );
          // Cliente no encontrado, continuar con error genérico
        }
      }

      if (!userData) {
        throw new EntityNotFoundException('User', userId);
      }

      const payload: UserPayload = {
        sub: userData.id,
        email: userData.email || userData.name,
        name: userData.name,
      };
      const accessToken = this.jwtService.sign(payload);
      return { accessToken };
    } catch (error) {
      this.logger.error('Error refreshing token:', error);
      if (error instanceof EntityNotFoundException) {
        throw error;
      }
      throw new UnauthorizedException('Error renewing token');
    }
  }

  logout(logoutDto: RefreshTokenDto): Promise<{ message: string }> {
    const { refreshToken } = logoutDto;

    // Eliminar refresh token
    this.refreshTokens.delete(refreshToken);

    return Promise.resolve({ message: 'Logout successful' });
  }

  private generateTokens(
    payload: UserPayload,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(
      { sub: payload.sub },
      { expiresIn: '7d' },
    );
    this.refreshTokens.set(refreshToken, payload.sub);
    return Promise.resolve({ accessToken, refreshToken });
  }

  private excludePassword<T extends { password?: string }>(
    user: T,
  ): Omit<T, 'password'> {
    const { password: _password, ...rest } = user;
    return rest;
  }

  // Método para validar JWT (para guards)
  async validateUser(payload: UserPayload) {
    try {
      // 1. Buscar primero en usuarios
      let userData = await this.userClient
        .send('findUserById', payload.sub)
        .toPromise();

      // 2. Si no existe, buscar en clientes
      if (!userData) {
        try {
          userData = await this.userClient
            .send('findClientById', payload.sub)
            .toPromise();
        } catch (error) {
          this.logger.error(
            `Error finding client by id in validate: ${error.message}`,
            error.stack,
          );
          // Cliente no encontrado, continuar con error genérico
        }
      }

      if (!userData) return null;

      return {
        id: userData.id,
        email: userData.email || userData.name,
        name: userData.name,
        isActive: true,
        createdAt: userData.created_at,
        updatedAt: userData.updated_at,
      };
    } catch (error) {
      this.logger.error('Error validating user:', error);
      return null;
    }
  }

  async validateToken(token: string) {
    try {
      if (!token) {
        return {
          isValid: false,
          error: 'Token not provided',
        };
      }

      // Verificar y decodificar el JWT
      const payload = this.jwtService.verify(token, {
        secret: envs.jwtSecretPassword,
      }) as UserPayload;

      // 1. Buscar primero en usuarios
      let userData = await this.userClient
        .send('findUserById', payload.sub)
        .toPromise();

      // 2. Si no existe, buscar en clientes
      if (!userData) {
        try {
          userData = await this.userClient
            .send('findClientById', payload.sub)
            .toPromise();
        } catch (error) {
          this.logger.error(
            `Error finding client by id in verifyToken: ${error.message}`,
            error.stack,
          );
          // Cliente no encontrado, continuar con error genérico
        }
      }

      if (!userData) {
        return {
          isValid: false,
          error: 'User not found',
        };
      }

      return {
        isValid: true,
        userId: userData.id,
        email: userData.email || userData.name,
        name: userData.name,
        isActive: true,
        createdAt: userData.created_at,
        updatedAt: userData.updated_at,
      };
    } catch {
      return {
        isValid: false,
        error: 'Invalid or expired token',
      };
    }
  }
}
