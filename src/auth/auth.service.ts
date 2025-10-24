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
    console.log('AuthService - Iniciando registro de usuario:', {
      email: registerDto.email,
    });

    const { password } = registerDto;

    console.log('AuthService - Hasheando contraseña...');
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('AuthService - Creando usuario en user-ms...');
    try {
      const createdUser = await this.userClient
        .send('createUser', {
          nombre: registerDto.nombre,
          email: registerDto.email,
          password: hashedPassword,
          role: registerDto.role,
        })
        .toPromise();

      const tokens = await this.generateTokens({
        sub: createdUser.id,
        email: createdUser.email,
        name: registerDto.nombre,
      });

      return {
        user: {
          id: createdUser.id,
          email: createdUser.email,
          name: registerDto.nombre,
          isActive: true,
          createdAt: createdUser.fecha_creacion,
          updatedAt: createdUser.fecha_actualizacion,
        },
        ...tokens,
      };
    } catch (error) {
      console.error('Error al crear usuario en user-ms:', error);
      throw new ConflictException(
        `Error al crear usuario: ${error.message}. Por favor, intente nuevamente.`,
      );
    }
  }

  async registerClient(registerDto: RegisterClientDto): Promise<AuthResponse> {
    console.log('AuthService - Iniciando registro de cliente:', {
      nombre: registerDto.nombre,
    });

    console.log('AuthService - Creando cliente en user-ms...');
    try {
      const createdClient = await this.userClient
        .send('createClient', {
          nombre: registerDto.nombre,
          descripcion: registerDto.descripcion,
          email: registerDto.email,
          password: registerDto.password,
        })
        .toPromise();

      const tokens = await this.generateTokens({
        sub: createdClient.id,
        email: createdClient.email || createdClient.nombre,
        name: createdClient.nombre,
      });

      return {
        user: {
          id: createdClient.id,
          email: createdClient.email || createdClient.nombre,
          name: createdClient.nombre,
          isActive: true,
          createdAt: createdClient.fecha_creacion,
          updatedAt: createdClient.fecha_actualizacion,
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

    console.log('AuthService - Iniciando login:', { email });

    try {
      // Buscar usuario en user-ms
      const userData = await this.userClient
        .send('findUserByEmail', email)
        .toPromise();

      if (!userData) {
        throw new UnauthorizedException('Credenciales inválidas');
      }

      // Verificar contraseña
      const ok = await bcrypt.compare(password, userData.password);
      if (!ok) {
        throw new UnauthorizedException('Credenciales inválidas');
      }

      const tokens = await this.generateTokens({
        sub: userData.id,
        email: userData.email,
        name: userData.nombre,
      });

      return {
        user: {
          id: userData.id,
          email: userData.email,
          name: userData.nombre,
          isActive: true,
          createdAt: userData.fecha_creacion,
          updatedAt: userData.fecha_actualizacion,
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
      // Obtener datos del usuario desde user-ms
      const userData = await this.userClient
        .send('findUserById', userId)
        .toPromise();

      if (!userData) {
        throw new UnauthorizedException('Usuario no encontrado');
      }

      const payload: UserPayload = {
        sub: userData.id,
        email: userData.email,
        name: userData.nombre,
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
      // Obtener datos del usuario desde user-ms
      const userData = await this.userClient
        .send('findUserById', payload.sub)
        .toPromise();

      if (!userData) return null;

      return {
        id: userData.id,
        email: userData.email,
        name: userData.nombre,
        isActive: true,
        createdAt: userData.fecha_creacion,
        updatedAt: userData.fecha_actualizacion,
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

      // Obtener datos del usuario desde user-ms
      const userData = await this.userClient
        .send('findUserById', payload.sub)
        .toPromise();

      if (!userData) {
        return {
          isValid: false,
          error: 'Usuario no encontrado',
        };
      }

      return {
        isValid: true,
        userId: userData.id,
        email: userData.email,
        name: userData.nombre,
        isActive: true,
        createdAt: userData.fecha_creacion,
        updatedAt: userData.fecha_actualizacion,
      };
    } catch {
      return {
        isValid: false,
        error: 'Token inválido o expirado',
      };
    }
  }
}
