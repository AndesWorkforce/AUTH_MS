import { INestApplication } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  MicroserviceOptions,
  Transport,
} from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { firstValueFrom } from 'rxjs';
import request from 'supertest';

import { AuthModule } from '../src/auth/auth.module';
import { LoginDto, RefreshTokenDto } from '../src/auth/dto/login-auth.dto';
import { RegisterClientDto } from '../src/auth/dto/register-client.dto';
import { RegisterUserDto, Role } from '../src/auth/dto/register-user.dto';

jest.mock('config', () => ({
  envs: {
    natsHost: 'localhost',
    natsPort: 4222,
    natsUsername: 'test',
    natsPassword: 'test',
    jwtSecretPassword: 'test-secret',
    devLogsEnabled: false,
    environment: 'development',
  },
  resolveLogLevels: () => ['error'],
  getLogModeMessage: () => 'test-mode',
  logError: jest.fn(),
  getMessagePattern: (pattern: string) => pattern,
}));

type StoredUser = {
  id: string;
  email: string;
  name: string;
  password?: string;
  created_at: Date;
  updated_at: Date;
};

type StoredClient = {
  id: string;
  name: string;
  email?: string;
  password?: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
};

describe('AuthModule (integration)', () => {
  let app: INestApplication;
  let client: ClientProxy;
  const tcpPort = 30100;

  const usersByEmail = new Map<string, StoredUser>();
  const usersById = new Map<string, StoredUser>();
  const clientsByEmail = new Map<string, StoredClient>();
  const clientsByName = new Map<string, StoredClient>();
  const clientsById = new Map<string, StoredClient>();

  let userCounter = 1;
  let clientCounter = 1;

  const asPromise = <T>(value: T) => ({
    toPromise: () => Promise.resolve(value),
  });

  const asRejectedPromise = (error: Error) => ({
    toPromise: () => Promise.reject(error),
  });

  const mockUserClient = {
    send: (pattern: string, payload: unknown) => {
      // getMessagePattern devuelve el pattern tal cual en el mock
      switch (pattern) {
        case 'createUser': {
          const data = payload as {
            name: string;
            email: string;
            password: string;
            role: Role;
          };

          if (usersByEmail.has(data.email)) {
            return asRejectedPromise(new Error('User already exists'));
          }

          const now = new Date();
          const user: StoredUser = {
            id: `user-${userCounter++}`,
            email: data.email,
            name: data.name,
            password: data.password,
            created_at: now,
            updated_at: now,
          };

          usersByEmail.set(user.email, user);
          usersById.set(user.id, user);

          return asPromise(user);
        }
        case 'createClient': {
          const data = payload as RegisterClientDto;
          if (clientsByName.has(data.name)) {
            return asRejectedPromise(new Error('Client duplicate entry'));
          }

          const now = new Date();
          const client: StoredClient = {
            id: `client-${clientCounter++}`,
            name: data.name,
            email: data.email,
            password: data.password,
            description: data.description,
            created_at: now,
            updated_at: now,
          };

          clientsByName.set(client.name, client);
          if (client.email) {
            clientsByEmail.set(client.email, client);
          }
          clientsById.set(client.id, client);

          return asPromise(client);
        }
        case 'findUserByEmail': {
          return asPromise(usersByEmail.get(payload as string));
        }
        case 'findClientByEmail': {
          return asPromise(clientsByEmail.get(payload as string));
        }
        case 'findUserById': {
          return asPromise(usersById.get(payload as string));
        }
        case 'findClientById': {
          return asPromise(clientsById.get(payload as string));
        }
        default:
          return asPromise(undefined);
      }
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideProvider('USER_SERVICE')
      .useValue(mockUserClient)
      .compile();

    app = moduleFixture.createNestApplication();
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.TCP,
      options: { port: tcpPort },
    });

    await app.startAllMicroservices();
    await app.init();

    client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { port: tcpPort },
    });
    await client.connect();
  });

  afterAll(async () => {
    await client.close();
    await app.close();
  });

  const registerUser = async (overrides: Partial<RegisterUserDto> = {}) => {
    const payload: RegisterUserDto = {
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123',
      role: Role.TeamAdmin,
      ...overrides,
    };

    const response = await firstValueFrom(
      client.send('auth.register.user', payload),
    );

    return { payload, response };
  };

  const registerClient = async (overrides: Partial<RegisterClientDto> = {}) => {
    const payload: RegisterClientDto = {
      name: 'Acme Inc.',
      email: 'acme@example.com',
      description: 'test client',
      password: 'clientpass',
      ...overrides,
    };

    const response = await firstValueFrom(
      client.send('auth.register.client', payload),
    );

    return { payload, response };
  };

  it('registers a user and stores hashed password', async () => {
    const { payload, response } = await registerUser();

    const storedUser = usersByEmail.get(payload.email)!;
    expect(storedUser).toBeDefined();
    expect(storedUser.password).toBeDefined();
    expect(storedUser.password).not.toEqual(payload.password);
    expect(await bcrypt.compare(payload.password, storedUser.password!)).toBe(
      true,
    );

    expect(response.user.email).toBe(payload.email);
    expect(response).toHaveProperty('accessToken');
    expect(response).toHaveProperty('refreshToken');
  });

  it('prevents duplicate user registration', async () => {
    const payload: RegisterUserDto = {
      name: 'Bob',
      email: 'alice@example.com',
      password: 'anotherpass',
      role: Role.Visualizer,
    };

    await firstValueFrom(client.send('auth.register.user', payload))
      .then(() => {
        throw new Error('Expected duplicate registration to fail');
      })
      .catch((error) => {
        expect(error.status).toBe('error');
        expect(error.message).toBe('Internal server error');
      });
  });

  it('registers a client and generates tokens', async () => {
    const { payload, response } = await registerClient();

    expect(response.user.name).toBe(payload.name);
    expect(response).toHaveProperty('accessToken');
    expect(response).toHaveProperty('refreshToken');
  });

  it('logs in an existing user and returns tokens', async () => {
    const loginPayload: LoginDto = {
      email: 'alice@example.com',
      password: 'password123',
    };

    const response = await firstValueFrom(
      client.send('auth.login', loginPayload),
    );

    expect(response.user.email).toBe(loginPayload.email);
    expect(response).toHaveProperty('accessToken');
    expect(response).toHaveProperty('refreshToken');
  });

  it('rejects login with invalid password', async () => {
    const loginPayload: LoginDto = {
      email: 'alice@example.com',
      password: 'wrong-password',
    };

    await firstValueFrom(client.send('auth.login', loginPayload))
      .then(() => {
        throw new Error('Expected login to be rejected');
      })
      .catch((error) => {
        expect(error.status).toBe('error');
        expect(error.message).toBe('Internal server error');
      });
  });

  it('refreshes tokens using a stored refresh token', async () => {
    const loginPayload: LoginDto = {
      email: 'alice@example.com',
      password: 'password123',
    };

    const loginResponse = await firstValueFrom(
      client.send('auth.login', loginPayload),
    );

    // Verificar que el login devolvió tokens
    expect(loginResponse).toHaveProperty('accessToken');
    expect(loginResponse).toHaveProperty('refreshToken');
    expect(loginResponse.refreshToken).toBeDefined();
    const originalAccessToken = loginResponse.accessToken;

    // Esperar un poco para asegurar que el nuevo token tenga un timestamp diferente
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const refreshPayload: RefreshTokenDto = {
      refreshToken: loginResponse.refreshToken,
    };

    const refreshResponse = await firstValueFrom(
      client.send('auth.refresh-token', refreshPayload),
    );

    // Verificar que el refresh devolvió un nuevo accessToken
    expect(refreshResponse).toHaveProperty('accessToken');
    expect(refreshResponse.accessToken).toBeDefined();
    expect(typeof refreshResponse.accessToken).toBe('string');
    expect(refreshResponse.accessToken.length).toBeGreaterThan(0);

    // El nuevo accessToken debe ser diferente del original
    // (esperamos 1 segundo para asegurar que tenga un timestamp diferente)
    expect(refreshResponse.accessToken).not.toEqual(originalAccessToken);
  });

  it('logs out and invalidates refresh token', async () => {
    const loginPayload: LoginDto = {
      email: 'alice@example.com',
      password: 'password123',
    };
    const loginResponse = await firstValueFrom(
      client.send('auth.login', loginPayload),
    );

    const logoutResponse = await firstValueFrom(
      client.send('auth.logout', {
        refreshToken: loginResponse.refreshToken,
      }),
    );

    expect(logoutResponse).toEqual({ message: 'Logout successful' });

    await firstValueFrom(
      client.send('auth.refresh-token', {
        refreshToken: loginResponse.refreshToken,
      }),
    )
      .then(() => {
        throw new Error('Expected refresh token to be invalid after logout');
      })
      .catch((error) => {
        expect(error.status).toBe('error');
        expect(error.message).toBe('Internal server error');
      });
  });

  it('validates token via HTTP endpoint', async () => {
    const loginPayload: LoginDto = {
      email: 'alice@example.com',
      password: 'password123',
    };
    const loginResponse = await firstValueFrom(
      client.send('auth.login', loginPayload),
    );

    const httpResponse = await request(app.getHttpServer())
      .get('/validate')
      .query({ token: loginResponse.accessToken })
      .expect(200);

    expect(httpResponse.body.isValid).toBe(true);
    expect(httpResponse.body.email).toBe(loginPayload.email);
  });

  it('returns invalid response for malformed token via HTTP', async () => {
    const httpResponse = await request(app.getHttpServer())
      .get('/validate')
      .query({ token: 'malformed.token.value' })
      .expect(200);

    expect(httpResponse.body.isValid).toBe(false);
    expect(httpResponse.body.error).toBe('Invalid or expired token');
  });
});
