import { IsEmail, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class RegisterClientDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  password?: string;
}
