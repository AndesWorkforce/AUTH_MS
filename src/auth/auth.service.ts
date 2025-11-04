import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClientProxy } from '@nestjs/microservices';
import * as bcrypt from 'bcryptjs';

import { envs } from 'config';

import { LoginDto, RefreshTokenDto } from './dto/login-auth.dto';
import { RegisterClientDto } from './dto/register-client.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { UserPayload, AuthResponse } from './entities/user.entity';

@Injectable()
export class AuthService {
  private refreshTokens: Map<string, string> = new Map();

  constructor(
    private readonly jwtService: JwtService,
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
  ) {}

  async registerUser(registerDto: RegisterUserDto): Promise<AuthResponse> {

    if (!registerDto.name) {
      throw new ConflictException('El campo name es requerido');
    }
    if (!registerDto.email) {
      throw new ConflictException('El campo email es requerido');
    }
    if (!registerDto.password) {
      throw new ConflictException('El campo password es requerido');
    }
    if (!registerDto.role) {
      throw new ConflictException('El campo role es requerido');
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
      console.error('Error al crear usuario en user-ms:', error);
      
      if (error?.message?.includes('already exists') || error?.message?.includes('duplicate')) {
        throw new ConflictException('El usuario ya existe con este email');
      }
      
      throw new ConflictException(
        `Error al crear usuario: ${error.message}. Por favor, intente nuevamente.`,
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
      console.error('Error al crear cliente en user-ms:', error);
      throw new ConflictException(
        `Error al crear cliente: ${error.message}. Por favor, intente nuevamente.`,
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
          // Cliente no encontrado, continuar con error genérico
        }
      }

      if (!userData) {
        throw new UnauthorizedException('Credenciales inválidas');
      }

      // 3. Verificar contraseña (solo si existe)
      if (userData.password) {
        const ok = await bcrypt.compare(password, userData.password);
        if (!ok) {
          throw new UnauthorizedException('Credenciales inválidas');
        }
      } else {
        // Cliente sin contraseña - permitir login (para casos donde no se requiere password)
        console.log('AuthService - Cliente sin contraseña, permitiendo login');
      }

      const tokens = await this.generateTokens({
        sub: userData.id,
        email: userData.email || userData.name,
        name: userData.name,
      });

      console.log(`AuthService - Login exitoso para ${userType}:`, { 
        id: userData.id, 
        email: userData.email || userData.name 
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
      console.error('Error en login:', error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Error al autenticar usuario');
    }
  }

  async refreshToken(
    refreshTokenDto: RefreshTokenDto,
  ): Promise<{ accessToken: string }> {
    const { refreshToken } = refreshTokenDto;
    const userId = this.refreshTokens.get(refreshToken);
    if (!userId) throw new UnauthorizedException('Refresh token inválido');

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
          // Cliente no encontrado, continuar con error genérico
        }
      }

      if (!userData) {
        throw new UnauthorizedException('Usuario no encontrado');
      }

      const payload: UserPayload = {
        sub: userData.id,
        email: userData.email || userData.name,
        name: userData.name,
      };
      const accessToken = this.jwtService.sign(payload);
      return { accessToken };
    } catch (error) {
      console.error('Error en refresh token:', error);
      throw new UnauthorizedException('Error al renovar token');
    }
  }

  logout(logoutDto: RefreshTokenDto): Promise<{ message: string }> {
    const { refreshToken } = logoutDto;

    // Eliminar refresh token
    this.refreshTokens.delete(refreshToken);

    return Promise.resolve({ message: 'Logout exitoso' });
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
      console.error('Error al validar usuario:', error);
      return null;
    }
  }

  async validateToken(token: string) {
    try {
      if (!token) {
        return {
          isValid: false,
          error: 'Token no proporcionado',
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
          // Cliente no encontrado, continuar con error genérico
        }
      }

      if (!userData) {
        return {
          isValid: false,
          error: 'Usuario no encontrado',
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
        error: 'Token inválido o expirado',
      };
    }
  }
}
