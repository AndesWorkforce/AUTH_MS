import {
  Injectable,
  UnauthorizedException,
  Inject,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClientProxy } from '@nestjs/microservices';
import * as bcrypt from 'bcryptjs';

import { envs, getMessagePattern, logError } from 'config';

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
    if (!registerDto.name) {
      throw new ConflictException('The name field is required');
    }
    if (!registerDto.email) {
      throw new ConflictException('The email field is required');
    }
    if (!registerDto.password) {
      throw new ConflictException('The password field is required');
    }
    if (!registerDto.role) {
      throw new ConflictException('The role field is required');
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
        .send(getMessagePattern('createUser'), userPayload)
        .toPromise();

      const tokens = await this.generateTokens({
        sub: createdUser.id,
        email: createdUser.email,
        name: registerDto.name,
        userType: 'user',
      });

      return {
        user: {
          id: createdUser.id,
          email: createdUser.email,
          name: registerDto.name,
          userType: 'user',
          isActive: true,
          createdAt: createdUser.created_at,
          updatedAt: createdUser.updated_at,
        },
        ...tokens,
      };
    } catch (error) {
      logError(this.logger, 'Error creating user in user-ms', error);

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
      // Hash password if provided
      const clientData: {
        name: string;
        description?: string;
        email?: string;
        password?: string;
      } = {
        name: registerDto.name,
        description: registerDto.description,
        email: registerDto.email,
      };

      if (registerDto.password) {
        const hashedPassword = await bcrypt.hash(registerDto.password, 10);
        clientData.password = hashedPassword;
      }

      const createdClient = await this.userClient
        .send(getMessagePattern('createClient'), clientData)
        .toPromise();

      const tokens = await this.generateTokens({
        sub: createdClient.id,
        email: createdClient.email || createdClient.name,
        name: createdClient.name,
        userType: 'client',
      });

      return {
        user: {
          id: createdClient.id,
          email: createdClient.email || createdClient.name,
          name: createdClient.name,
          userType: 'client',
          isActive: true,
          createdAt: createdClient.created_at,
          updatedAt: createdClient.updated_at,
        },
        ...tokens,
      };
    } catch (error) {
      logError(this.logger, 'Error creating client in user-ms', error);

      // Handle duplicate entity exception from USER_MS
      if (error?.statusCode === 409 || error?.status === 409) {
        // This is a DuplicateEntityException from USER_MS
        throw error; // Re-throw the exception as-is
      }

      if (
        error?.message?.includes('already exists') ||
        error?.message?.includes('duplicate') ||
        error?.code === 'P2002'
      ) {
        const field = error?.field || 'name';
        const value = error?.value || registerDto.name || registerDto.email;
        throw new DuplicateEntityException('Client', field, value);
      }

      throw new ValidationException(
        `Error creating client: ${error.message || 'Unknown error'}. Please try again.`,
      );
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;

    try {
      // 1. Buscar primero en usuarios
      let userData: {
        userType: 'user' | 'client';
        id: string;
        email?: string;
        name: string;
        password?: string;
        role?: string;
        extraRoles?: string[];
        created_at: Date;
        updated_at: Date;
      } | null = null;

      try {
        userData = await this.userClient
          .send(getMessagePattern('findUserByEmail'), email)
          .toPromise();
      } catch {
        // This is expected when the email doesn't belong to a user
        // We'll check clients next, so this is not an error
      }

      // 2. Si no existe, buscar en clientes
      if (!userData) {
        try {
          userData = await this.userClient
            .send(getMessagePattern('findClientByEmail'), email)
            .toPromise();
        } catch {
          // This is expected when the email doesn't belong to a client either
        }
      }

      if (!userData) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // 3. Verificar contraseña - todos (usuarios y clientes) deben tener contraseña
      if (!password) {
        throw new UnauthorizedException('Password is required');
      }

      if (!userData.password) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const ok = await bcrypt.compare(password, userData.password);
      if (!ok) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const tokens = await this.generateTokens({
        sub: userData.id,
        email: userData.email || userData.name,
        name: userData.name,
        userType: userData.userType,
      });

      this.logger.debug(
        `Login - User extraRoles: ${JSON.stringify(userData.extraRoles)}, type: ${typeof userData.extraRoles}, isArray: ${Array.isArray(userData.extraRoles)}`,
      );

      const extraRoles =
        userData.extraRoles &&
        Array.isArray(userData.extraRoles) &&
        userData.extraRoles.length > 0
          ? userData.extraRoles
          : undefined;

      return {
        user: {
          id: userData.id,
          email: userData.email || userData.name,
          name: userData.name,
          role: userData.role,
          extraRoles,
          userType: userData.userType,
          isActive: true,
          createdAt: userData.created_at,
          updatedAt: userData.updated_at,
        },
        ...tokens,
      };
    } catch (error) {
      logError(this.logger, 'Error during login', error);
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

    if (!refreshToken) {
      this.logger.warn('Refresh token not provided');
      throw new UnauthorizedException('Refresh token is required');
    }

    const userId = this.refreshTokens.get(refreshToken);
    if (!userId) {
      this.logger.warn(
        `Invalid refresh token: ${refreshToken.substring(0, 10)}...`,
      );
      throw new UnauthorizedException('Invalid refresh token');
    }

    try {
      // 1. Buscar primero en usuarios
      let userData: any = null;
      try {
        userData = await this.userClient
          .send(getMessagePattern('findUserById'), userId)
          .toPromise();
      } catch (error) {
        logError(
          this.logger,
          `User lookup by id failed (refreshToken) for userId: ${userId}`,
          error,
        );
      }

      // 2. Si no existe, buscar en clientes
      if (!userData) {
        try {
          // Nota: findClientById puede no usar getMessagePattern según validateToken
          userData = await this.userClient
            .send(getMessagePattern('findClientById'), userId)
            .toPromise();
        } catch (error) {
          logError(
            this.logger,
            `Client lookup by id failed (refreshToken fallback) for userId: ${userId}`,
            error,
          );
        }
      }

      if (!userData) {
        this.logger.error(
          `User not found for refresh token. userId: ${userId}, refreshToken: ${refreshToken.substring(0, 10)}...`,
        );
        throw new EntityNotFoundException('User', userId);
      }

      const payload: UserPayload = {
        sub: userData.id,
        email: userData.email || userData.name,
        name: userData.name,
        userType: userData.userType,
      };
      const accessToken = this.jwtService.sign(payload);
      this.logger.debug(
        `Token refreshed successfully for user: ${userData.id}`,
      );
      return { accessToken };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof EntityNotFoundException
      ) {
        throw error;
      }
      logError(this.logger, 'Error refreshing token', error);
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
    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
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
          logError(
            this.logger,
            'Client lookup by id failed (validateUser)',
            error,
          );
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
      logError(this.logger, 'Error validating user', error);
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
      let payload: UserPayload;
      try {
        payload = this.jwtService.verify(token, {
          secret: envs.jwtSecretPassword,
        }) as UserPayload;
      } catch {
        return {
          isValid: false,
          error: 'Invalid or expired token',
        };
      }

      // 1. Buscar primero en usuarios
      let userData: {
        id: string;
        email?: string;
        name: string;
        role?: string;
        extraRoles?: string[];
        userType: 'user' | 'client';
        created_at: Date;
        updated_at: Date;
      } | null = null;
      let userType: 'user' | 'client' = 'user';
      let role: string | null = null;
      let extraRoles: string[] | null = null;

      try {
        userData = await this.userClient
          .send(getMessagePattern('findUserById'), payload.sub)
          .toPromise();

        if (userData) {
          userType = 'user';
          role = userData.role ?? null;
          extraRoles = userData.extraRoles ?? null;
        }
      } catch (error) {
        logError(
          this.logger,
          'User lookup by id failed (validateToken)',
          error,
        );
      }

      // 2. Si no existe, buscar en clientes
      if (!userData) {
        try {
          // Usar el mismo message pattern que USER_MS expone para findClientById
          userData = await this.userClient
            .send(getMessagePattern('findClientById'), payload.sub)
            .toPromise();
          userType = 'client';
          role = null; // Clients don't tienen roles
        } catch (error) {
          logError(
            this.logger,
            'Client lookup by id failed (validateToken)',
            error,
          );
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
        createdAt: userData.created_at
          ? new Date(userData.created_at).toISOString()
          : new Date().toISOString(),
        updatedAt: userData.updated_at
          ? new Date(userData.updated_at).toISOString()
          : new Date().toISOString(),
        userType,
        role,
        extraRoles,
      };
    } catch (error) {
      logError(this.logger, 'Unexpected error in validateToken', error);
      return {
        isValid: false,
        error: 'Invalid or expired token',
      };
    }
  }
}
