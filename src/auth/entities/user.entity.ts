export class User {
  id: string;
  email: string;
  password: string;
  name: string;
  role?: string; // ✅ Agregar campo role
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPayload {
  sub: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  user: Omit<User, 'password'>;
  accessToken: string;
  refreshToken: string;
}
