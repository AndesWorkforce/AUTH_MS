import { Injectable, Inject, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import * as bcrypt from 'bcryptjs';

import { envs } from 'config';

import {} from // Excepciones personalizadas eliminadas temporalmente
'../common';
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
    try {
      if (!registerDto.name) {
        throw new RpcException({
          status: 409,
          message: 'The name field is required',
          custom: 'Missing name',
        });
      }
      if (!registerDto.email) {
        throw new RpcException({
          status: 409,
          message: 'The email field is required',
          custom: 'Missing email',
        });
      }
      if (!registerDto.password) {
        throw new RpcException({
          status: 409,
          message: 'The password field is required',
          custom: 'Missing password',
        });
      }
      if (!registerDto.role) {
        throw new RpcException({
          status: 409,
          message: 'The role field is required',
          custom: 'Missing role',
        });
      }

      const { password } = registerDto;
      const hashedPassword = await bcrypt.hash(password, 10);
      const userPayload = {
        name: registerDto.name,
        email: registerDto.email,
        password: hashedPassword,
        role: registerDto.role,
      };

      let createdUser;
      try {
        createdUser = await this.userClient
          .send('createUser', userPayload)
          .toPromise();
      } catch (error) {
        this.logger.error('Error creating user in user-ms', error);
        if (
          error?.message?.includes('already exists') ||
          error?.message?.includes('duplicate')
        ) {
          throw new RpcException({
            status: 409,
            message: 'User already exists',
            custom: 'Duplicate email',
          });
        }
        throw new RpcException({
          status: 500,
          message: 'Error creating user',
          custom: error.message,
        });
      }

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
      this.logger.error('Error during registerUser', error);
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Internal error registering user',
        custom: error.message,
      });
    }
  }

  async registerClient(registerDto: RegisterClientDto): Promise<AuthResponse> {
    try {
      let createdClient;
      try {
        createdClient = await this.userClient
          .send('createClient', {
            name: registerDto.name,
            description: registerDto.description,
            email: registerDto.email,
            password: registerDto.password,
          })
          .toPromise();
      } catch (error) {
        this.logger.error('Error creating client in user-ms', error);
        if (
          error?.message?.includes('already exists') ||
          error?.message?.includes('duplicate')
        ) {
          throw new RpcException({
            status: 409,
            message: 'Client already exists',
            custom: 'Duplicate client',
          });
        }
        throw new RpcException({
          status: 500,
          message: 'Error creating client',
          custom: error.message,
        });
      }

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
      this.logger.error('Error during registerClient', error);
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Internal error registering client',
        custom: error.message,
      });
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;

    try {
      const { userData, userType } = await this.findUserByEmail(email);

      if (!userData) {
        throw new RpcException({
          status: 418,
          message: 'Invalid credentials',
          custom: 'User not found',
        });
      }

      if (userData.password) {
        const ok = await bcrypt.compare(password, userData.password);
        if (!ok) {
          throw new RpcException({
            status: 418,
            message: 'Invalid credentials',
            custom: 'Invalid password',
          });
        }
      }

      const tokens = await this.generateTokens({
        sub: userData.id,
        email: (userData.email ?? userData.name ?? '') as string,
        name: (userData.name ?? userData.email ?? '') as string,
      });

      this.logger.debug(`Successful login for ${userType}`, {
        id: userData.id,
        email: userData.email || userData.name,
      });

      return {
        user: {
          id: userData.id,
          email: (userData.email ?? userData.name ?? '') as string,
          name: (userData.name ?? userData.email ?? '') as string,
          isActive: true,
          createdAt: userData.created_at as unknown as Date,
          updatedAt: userData.updated_at as unknown as Date,
        },
        ...tokens,
      };
    } catch (error) {
      this.logger.error('Error during login', error);

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: error.status || 500,
        message: error.message || 'Internal error during login',
        custom: error.custom || error.message,
      });
    }
  }

  private async findUserByEmail(
    email: string,
  ): Promise<{ userData: any; userType: 'user' | 'client' }> {
    let userData: any = null;
    let userType: 'user' | 'client' = 'user';

    try {
      userData = await this.userClient
        .send('findUserByEmail', email)
        .toPromise();
    } catch (err) {
      // If primary lookup fails unexpectedly, log and continue to fallback
      this.logger.error('User lookup by email failed', err);
    }

    if (!userData) {
      try {
        userData = await this.userClient
          .send('findClientByEmail', email)
          .toPromise();
        userType = 'client';
      } catch (err) {
        // Fallback failure is non-fatal for login flow: log and return null
        this.logger.error(
          'Client lookup by email failed (login fallback)',
          err,
        );
      }
    }

    return { userData, userType };
  }

  async refreshToken(
    refreshTokenDto: RefreshTokenDto,
  ): Promise<{ accessToken: string }> {
    try {
      const { refreshToken } = refreshTokenDto;
      const userId = this.refreshTokens.get(refreshToken);
      if (!userId) {
        throw new RpcException({
          status: 401,
          message: 'Invalid refresh token',
          custom: 'Refresh token not found',
        });
      }

      let userData;
      try {
        userData = await this.userClient
          .send('findUserById', userId)
          .toPromise();
      } catch (error) {
        this.logger.error('User lookup by id failed (refreshToken)', error);
      }

      if (!userData) {
        try {
          userData = await this.userClient
            .send('findClientById', userId)
            .toPromise();
        } catch (error) {
          this.logger.error(
            'Client lookup by id failed (refreshToken fallback)',
            error,
          );
        }
      }

      if (!userData) {
        throw new RpcException({
          status: 404,
          message: 'User not found',
          custom: 'User not found for refresh token',
        });
      }

      const payload: UserPayload = {
        sub: userData.id,
        email: userData.email || userData.name,
        name: userData.name,
      };
      const accessToken = this.jwtService.sign(payload);
      return { accessToken };
    } catch (error) {
      this.logger.error('Error during refreshToken', error);
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Internal error refreshing token',
        custom: error.message,
      });
    }
  }

  logout(logoutDto: RefreshTokenDto): Promise<{ message: string }> {
    try {
      const { refreshToken } = logoutDto;
      if (!refreshToken) {
        throw new RpcException({
          status: 400,
          message: 'Refresh token is required',
          custom: 'Missing refresh token',
        });
      }
      this.refreshTokens.delete(refreshToken);
      return Promise.resolve({ message: 'Logout successful' });
    } catch (error) {
      this.logger.error('Error during logout', error);
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 500,
        message: 'Internal error during logout',
        custom: error.message,
      });
    }
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
          this.logger.error('Client lookup by id failed (validateUser)', error);
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
      this.logger.error('Error validating user', error);
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
