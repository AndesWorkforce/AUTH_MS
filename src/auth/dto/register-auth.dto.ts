import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  apellido: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  puesto_trabajo: string;

  @IsString()
  @IsOptional()
  horario_laboral_inicio?: string;

  @IsString()
  @IsOptional()
  horario_laboral_fin?: string;

  @IsString()
  @IsOptional()
  cliente_id?: string;

  @IsString()
  @IsOptional()
  team_id?: string;

  @IsString()
  @IsOptional()
  subteam_id?: string;
}
