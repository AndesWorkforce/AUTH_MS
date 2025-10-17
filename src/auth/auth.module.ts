import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ProfileController } from './profile.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    ClientsModule.register([
      {
        name: 'USER_SERVICE',
        transport: Transport.NATS,
        options: {
          servers: [
            `nats://${process.env.NATS_HOST}:${process.env.NATS_PORT}` ||
              'nats://localhost:4222',
          ],
          user: process.env.NATS_USERNAME,
          pass: process.env.NATS_PASSWORD,
        },
      },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'tu-secret-key-super-seguro',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AuthController, ProfileController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
