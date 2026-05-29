import bcrypt from 'bcrypt';
import { prisma } from '../../config/prisma';
import { signAuthToken } from '../../services/jwt/jwt.service';
import type { RegisterDto, LoginDto } from './auth.schema';

const SALT_ROUNDS = 12;

export async function registerUser(dto: RegisterDto) {
  const existing = await prisma.user.findUnique({ where: { email: dto.email } });
  if (existing) {
    throw new Error('EMAIL_TAKEN');
  }

  const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { name: dto.name, email: dto.email, passwordHash },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  const token = signAuthToken(user.id, user.email);
  return { user, token };
}

export async function loginUser(dto: LoginDto) {
  const user = await prisma.user.findUnique({ where: { email: dto.email } });
  if (!user) throw new Error('INVALID_CREDENTIALS');

  const valid = await bcrypt.compare(dto.password, user.passwordHash);
  if (!valid) throw new Error('INVALID_CREDENTIALS');

  const token = signAuthToken(user.id, user.email);
  return {
    user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
    token,
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, createdAt: true },
  });
  if (!user) throw new Error('USER_NOT_FOUND');
  return user;
}
