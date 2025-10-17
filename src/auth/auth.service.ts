import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClientProxy } from '@nestjs/microservices';
import * as bcrypt from 'bcryptjs';

import { LoginDto, RefreshTokenDto } from './dto/login-auth.dto';
import { RegisterDto } from './dto/register-auth.dto';
import { UserPayload, AuthResponse } from './entities/user.entity';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  private refreshTokens: Map<string, string> = new Map();

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, password } = registerDto;

    const existing = await this.prisma.authUser.findUnique({
      where: { email },
    });
    if (existing) throw new ConflictException('El usuario ya existe');

    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear solo datos de autenticación
    const created = await this.prisma.authUser.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    const tokens = await this.generateTokens({
      sub: created.id,
      email: created.email,
      name: `${registerDto.nombre} ${registerDto.apellido}`,
    });

    // Crear usuario completo en user-ms vía NATS
    try {
      await this.userClient
        .send('createUser', {
          auth_user_id: created.id,
          nombre: registerDto.nombre,
          apellido: registerDto.apellido,
          email: registerDto.email,
          password: hashedPassword, // Agregar password
          puesto_trabajo: registerDto.puesto_trabajo,
          horario_laboral_inicio: registerDto.horario_laboral_inicio,
          horario_laboral_fin: registerDto.horario_laboral_fin,
          cliente_id: registerDto.cliente_id,
          team_id: registerDto.team_id,
          subteam_id: registerDto.subteam_id,
        })
        .toPromise();
    } catch (error) {
      // Si falla la creación en user-ms, eliminar el usuario de auth
      await this.prisma.authUser.delete({ where: { id: created.id } });
      console.error('Error al crear usuario en user-ms:', error);
      throw new Error(
        `Error al crear usuario completo: ${error.message}. Por favor, intente nuevamente.`,
      );
    }

    return {
      user: {
        id: created.id,
        email: created.email,
        name: `${registerDto.nombre} ${registerDto.apellido}`,
        isActive: created.isActive,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
      ...tokens,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;

    const user = await this.prisma.authUser.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    // Obtener datos completos del usuario desde user-ms vía NATS
    const userData = await this.userClient
      .send('findUserByAuthId', user.id)
      .toPromise();

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      name: userData ? `${userData.nombre} ${userData.apellido}` : 'Usuario',
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: userData ? `${userData.nombre} ${userData.apellido}` : 'Usuario',
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      ...tokens,
    };
  }

  async refreshToken(
    refreshTokenDto: RefreshTokenDto,
  ): Promise<{ accessToken: string }> {
    const { refreshToken } = refreshTokenDto;
    const userId = this.refreshTokens.get(refreshToken);
    if (!userId) throw new UnauthorizedException('Refresh token inválido');

    const user = await this.prisma.authUser.findUnique({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    // Obtener datos completos del usuario desde user-ms vía NATS
    const userData = await this.userClient
      .send('findUserByAuthId', user.id)
      .toPromise();

    const payload: UserPayload = {
      sub: user.id,
      email: user.email,
      name: userData ? `${userData.nombre} ${userData.apellido}` : 'Usuario',
    };
    const accessToken = this.jwtService.sign(payload);
    return { accessToken };
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
    const user = await this.prisma.authUser.findUnique({
      where: { id: payload.sub },
    });

    if (!user) return null;

    // Obtener datos completos del usuario desde user-ms vía NATS
    const userData = await this.userClient
      .send('findUserByAuthId', user.id)
      .toPromise();

    return {
      id: user.id,
      email: user.email,
      name: userData ? `${userData.nombre} ${userData.apellido}` : 'Usuario',
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
