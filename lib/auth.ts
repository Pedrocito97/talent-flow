import NextAuth, { DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

// Define UserRole type locally to avoid importing from Prisma in edge contexts
// This must match the Prisma enum
type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

// Extend the default session types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession['user'];
  }

  interface User {
    role: UserRole;
  }
}

// Login schema validation
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Validate input
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;

        // Find user by email
        const user = await db.user.findUnique({
          where: {
            email: email.toLowerCase(),
            deletedAt: null,
          },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            role: true,
            activatedAt: true,
          },
        });

        // User not found or not activated
        if (!user || !user.passwordHash || !user.activatedAt) {
          return null;
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        if (!isValidPassword) {
          return null;
        }

        // Return user data (without password)
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as UserRole,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
});
