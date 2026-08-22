import 'server-only';

import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { database } from '@profitopath/database';
import {
  hashPassword,
  loginInputSchema,
  parseRuntimeEnv,
  verifyPassword,
} from '@profitopath/shared';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const env = parseRuntimeEnv();

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(database),
  callbacks: {
    async jwt({ token, user }) {
      if (user !== undefined) {
        token.role = user.role;
        token.status = user.status;
      } else if (token.sub !== undefined) {
        const currentUser = await database.user.findUnique({
          select: { role: true, status: true },
          where: { id: token.sub },
        });
        token.role = currentUser?.role ?? 'TRADER';
        token.status = currentUser?.status ?? 'CLOSED';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user !== undefined && token.sub !== undefined) {
        session.user.id = token.sub;
        session.user.role = token.role;
        session.user.status = token.status;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      await database.auditEvent.create({
        data: {
          action: 'SIGNED_IN',
          actorUserId: user.id,
          entityId: user.id,
          entityType: 'User',
        },
      });
    },
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      name: 'Email and password',
      async authorize(credentials) {
        const parsed = loginInputSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const user = await database.user.findUnique({
          include: { credential: true },
          where: { email: parsed.data.email },
        });
        if (
          user?.credential === null ||
          user === null ||
          user.status !== 'ACTIVE'
        ) {
          await hashPassword(parsed.data.password);
          return null;
        }

        const valid = await verifyPassword(
          parsed.data.password,
          user.credential.passwordHash,
        );
        if (!valid) {
          return null;
        }

        return {
          email: user.email,
          id: user.id,
          name: user.displayName ?? user.name ?? user.email,
          role: user.role,
          status: user.status,
        };
      },
    }),
  ],
  secret: env.NEXTAUTH_SECRET,
  session: {
    maxAge: 7 * 24 * 60 * 60,
    strategy: 'jwt',
  },
};
