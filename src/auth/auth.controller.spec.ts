import { Test, TestingModule } from '@nestjs/testing';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto, LogoutDto, RefreshTokenDto } from './dto/login-auth.dto';
import { RegisterClientDto } from './dto/register-client.dto';
import { RegisterUserDto, Role } from './dto/register-user.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockAuthService = {
    registerUser: jest.fn(),
    registerClient: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
    validateToken: jest.fn(),
    validateUser: jest.fn(),
  } as unknown as jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService) as jest.Mocked<AuthService>;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('registerUser delegates to AuthService', async () => {
    const dto: RegisterUserDto = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'secret123',
      role: Role.TeamAdmin,
    };
    const response = { ok: true };
    authService.registerUser.mockResolvedValue(response as never);

    await expect(controller.registerUser(dto)).resolves.toEqual(response);
    expect(authService.registerUser).toHaveBeenCalledWith(dto);
  });

  it('registerClient delegates to AuthService', async () => {
    const dto: RegisterClientDto = {
      name: 'Client',
      email: 'client@example.com',
      description: 'Desc',
      password: 'secret123',
    };
    const response = { ok: true };
    authService.registerClient.mockResolvedValue(response as never);

    await expect(controller.registerClient(dto)).resolves.toEqual(response);
    expect(authService.registerClient).toHaveBeenCalledWith(dto);
  });

  it('login delegates to AuthService', async () => {
    const dto: LoginDto = { email: 'john@example.com', password: 'secret123' };
    const response = { token: 'abc' };
    authService.login.mockResolvedValue(response as never);

    await expect(controller.login(dto)).resolves.toEqual(response);
    expect(authService.login).toHaveBeenCalledWith(dto);
  });

  it('refreshToken delegates to AuthService', async () => {
    const dto: RefreshTokenDto = { refreshToken: 'refresh' };
    const response = { accessToken: 'newToken' };
    authService.refreshToken.mockResolvedValue(response as never);

    await expect(controller.refreshToken(dto)).resolves.toEqual(response);
    expect(authService.refreshToken).toHaveBeenCalledWith(dto);
  });

  it('logout delegates to AuthService', async () => {
    const dto: LogoutDto = { refreshToken: 'refresh' };
    const response = { message: 'Logout successful' };
    authService.logout.mockResolvedValue(response as never);

    await expect(controller.logout(dto)).resolves.toEqual(response);
    expect(authService.logout).toHaveBeenCalledWith(dto);
  });

  it('validateToken delegates to AuthService', async () => {
    const token = 'token123';
    const response = { isValid: true };
    authService.validateToken.mockResolvedValue(response as never);

    await expect(controller.validateToken(token)).resolves.toEqual(response);
    expect(authService.validateToken).toHaveBeenCalledWith(token);
  });

  it('validateTokenHttp delegates to AuthService', async () => {
    const token = 'token456';
    const response = { isValid: true };
    authService.validateToken.mockResolvedValue(response as never);

    await expect(controller.validateTokenHttp(token)).resolves.toEqual(
      response,
    );
    expect(authService.validateToken).toHaveBeenCalledWith(token);
  });
});
