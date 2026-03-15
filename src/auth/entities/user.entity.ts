export class User {
  id: string;
  email: string;
  password: string;
  name: string;
  userType: 'user' | 'client' | 'agent';
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
  userType: 'user' | 'client' | 'agent';
}

export interface AuthResponse {
  user: Omit<User, 'password'> & { userType: 'user' | 'client' | 'agent' };
  accessToken: string;
  refreshToken: string;
}
