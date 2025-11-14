import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';

import { DuplicateEntityException, ValidationException } from '../common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login-auth.dto';
import { RegisterClientDto } from './dto/register-client.dto';
import { RegisterUserDto, Role } from './dto/register-user.dto';

jest.mock('config', () => ({
  envs: {
    devLogsEnabled: false,
    jwtSecretPassword: 'jwt-secret',
  },
  logError: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: jest.Mocked<JwtService>;
  const mockSend = jest.fn();

  const mockUserService = {
    send: mockSend,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: 'USER_SERVICE',
          useValue: mockUserService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get(JwtService);
    mockSend.mockReset();
    jest.clearAllMocks();
  });

  const getRefreshTokensMap = () =>
    (service as unknown as { refreshTokens: Map<string, string> })
      .refreshTokens;

  describe('registerUser', () => {
    const dto: RegisterUserDto = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'secret123',
      role: Role.TeamAdmin,
    };

    it('creates user, hashes password and returns tokens', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const createdUser = {
        id: 'user-id',
        email: dto.email,
        name: dto.name,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockSend.mockReturnValue({
        toPromise: jest.fn().mockResolvedValue(createdUser),
      });

      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await service.registerUser(dto);

      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 10);
      expect(mockSend).toHaveBeenCalledWith('createUser', {
        name: dto.name,
        email: dto.email,
        password: 'hashed-password',
        role: dto.role,
      });
      expect(result).toMatchObject({
        user: {
          id: createdUser.id,
          email: createdUser.email,
          name: dto.name,
          isActive: true,
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('throws ConflictException when mandatory fields are missing', async () => {
      await expect(
        service.registerUser({ ...dto, name: '' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws DuplicateEntityException when user already exists', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      mockSend.mockReturnValue({
        toPromise: jest
          .fn()
          .mockRejectedValue(new Error('User already exists')),
      });

      await expect(service.registerUser(dto)).rejects.toBeInstanceOf(
        DuplicateEntityException,
      );
    });

    it('throws ValidationException when an unknown error occurs', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      mockSend.mockReturnValue({
        toPromise: jest.fn().mockRejectedValue(new Error('Unexpected error')),
      });

      await expect(service.registerUser(dto)).rejects.toBeInstanceOf(
        ValidationException,
      );
    });
  });

  describe('registerClient', () => {
    const dto: RegisterClientDto = {
      name: 'Client',
      description: 'Important client',
      email: 'client@example.com',
      password: 'client-secret',
    };

    it('creates client and returns tokens', async () => {
      const createdClient = {
        id: 'client-id',
        email: dto.email,
        name: dto.name,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockSend.mockReturnValue({
        toPromise: jest.fn().mockResolvedValue(createdClient),
      });

      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await service.registerClient(dto);

      expect(mockSend).toHaveBeenCalledWith('createClient', {
        name: dto.name,
        description: dto.description,
        email: dto.email,
        password: dto.password,
      });
      expect(result).toMatchObject({
        user: expect.objectContaining({
          id: createdClient.id,
          email: createdClient.email,
          name: createdClient.name,
        }),
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('throws DuplicateEntityException when client name already exists', async () => {
      mockSend.mockReturnValue({
        toPromise: jest
          .fn()
          .mockRejectedValue(new Error('Client duplicate entry')),
      });

      await expect(service.registerClient(dto)).rejects.toBeInstanceOf(
        DuplicateEntityException,
      );
    });

    it('throws ValidationException on unexpected errors', async () => {
      mockSend.mockReturnValue({
        toPromise: jest.fn().mockRejectedValue(new Error('Broken pipeline')),
      });

      await expect(service.registerClient(dto)).rejects.toBeInstanceOf(
        ValidationException,
      );
    });
  });

  describe('login', () => {
    const dto: LoginDto = {
      email: 'john@example.com',
      password: 'secret123',
    };

    it('returns tokens when credentials are valid', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const userData = {
        id: 'user-id',
        email: dto.email,
        name: 'John Doe',
        password: 'hashed',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockSend.mockImplementation((pattern: string) => {
        if (pattern === 'findUserByEmail') {
          return { toPromise: jest.fn().mockResolvedValue(userData) };
        }
        return { toPromise: jest.fn().mockResolvedValue(undefined) };
      });

      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await service.login(dto);

      expect(bcrypt.compare).toHaveBeenCalledWith(
        dto.password,
        userData.password,
      );
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('looks up clients when user is not found', async () => {
      const clientData = {
        id: 'client-id',
        name: 'Client',
        email: 'client@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockSend.mockImplementation((pattern: string) => {
        if (pattern === 'findUserByEmail') {
          return { toPromise: jest.fn().mockResolvedValue(undefined) };
        }
        if (pattern === 'findClientByEmail') {
          return { toPromise: jest.fn().mockResolvedValue(clientData) };
        }
        return { toPromise: jest.fn().mockResolvedValue(undefined) };
      });

      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await service.login(dto);

      expect(result.user.id).toBe(clientData.id);
    });

    it('throws UnauthorizedException when credentials are invalid', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const userData = {
        id: 'user-id',
        email: dto.email,
        name: 'John Doe',
        password: 'hashed',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockSend.mockImplementation((pattern: string) => {
        if (pattern === 'findUserByEmail') {
          return { toPromise: jest.fn().mockResolvedValue(userData) };
        }
        return { toPromise: jest.fn().mockResolvedValue(undefined) };
      });

      await expect(service.login(dto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when no user or client is found', async () => {
      mockSend.mockReturnValue({
        toPromise: jest.fn().mockResolvedValue(undefined),
      });

      await expect(service.login(dto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('refreshToken', () => {
    it('returns new accessToken when refreshToken is valid', async () => {
      const refreshToken = 'refresh';
      const userData = {
        id: 'user-id',
        email: 'john@example.com',
        name: 'John Doe',
      };

      const refreshTokens = getRefreshTokensMap();
      refreshTokens.set(refreshToken, userData.id);

      mockSend.mockImplementation((pattern: string) => {
        if (pattern === 'findUserById') {
          return { toPromise: jest.fn().mockResolvedValue(userData) };
        }
        return { toPromise: jest.fn().mockResolvedValue(undefined) };
      });

      jwtService.sign.mockReturnValue('new-access-token');

      const result = await service.refreshToken({ refreshToken });

      expect(result.accessToken).toBe('new-access-token');
    });

    it('throws UnauthorizedException when refreshToken is missing', async () => {
      await expect(
        service.refreshToken({ refreshToken: 'invalid' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('removes refreshToken and resolves with success message', async () => {
      const refreshTokens = getRefreshTokensMap();
      refreshTokens.set('refresh', 'user-id');

      const result = await service.logout({ refreshToken: 'refresh' });

      expect(refreshTokens.has('refresh')).toBe(false);
      expect(result).toEqual({ message: 'Logout successful' });
    });
  });

  describe('validateToken', () => {
    it('returns user data when token is valid', async () => {
      const payload = {
        sub: 'user-id',
        email: 'john@example.com',
        name: 'John',
      };
      jwtService.verify.mockReturnValue(payload as never);

      const userData = {
        id: 'user-id',
        email: 'john@example.com',
        name: 'John',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockSend.mockImplementation((pattern: string) => {
        if (pattern === 'findUserById') {
          return { toPromise: jest.fn().mockResolvedValue(userData) };
        }
        return { toPromise: jest.fn().mockResolvedValue(undefined) };
      });

      const result = await service.validateToken('valid-token');

      expect(result.isValid).toBe(true);
      expect(result.userId).toBe(userData.id);
    });

    it('returns invalid when token cannot be verified', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      const result = await service.validateToken('invalid-token');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid or expired token');
    });

    it('returns invalid when user cannot be found', async () => {
      const payload = { sub: 'user-id' };
      jwtService.verify.mockReturnValue(payload as never);

      mockSend.mockReturnValue({
        toPromise: jest.fn().mockResolvedValue(undefined),
      });

      const result = await service.validateToken('valid-token');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('User not found');
    });
  });
});
