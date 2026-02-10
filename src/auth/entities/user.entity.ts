export class User {
  id: string;
  email: string;
  password: string;
  name: string;
  userType: 'user' | 'client';
  role?: string;
  extraRoles?: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPayload {
  sub: string;
  email: string;
  name: string;
  userType: 'user' | 'client';
}

export interface AuthResponse {
  user: Omit<User, 'password'> & { userType: 'user' | 'client' };
  accessToken: string;
  refreshToken: string;
}
