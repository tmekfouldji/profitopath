import 'server-only';

import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { database } from '@profitopath/database';
import {
  createLogger,
  hashPassword,
  loginInputSchema,
  parseRuntimeEnv,
  verifyPassword,
} from '@profitopath/shared';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import { authLoginRateLimiter, loginAuditIdentifier } from './login-rate-limit';

const env = parseRuntimeEnv();
const logger = createLogger({ service: 'web-auth', version: '0.1.0' });

async function recordFailedSignIn(
  email: string,
  reason:
    | 'ACCOUNT_INACTIVE'
    | 'AUTH_RATE_LIMIT_UNAVAILABLE'
    | 'INVALID_CREDENTIALS'
    | 'RATE_LIMITED',
): Promise<void> {
  await database.auditEvent
    .create({
      data: {
        action: 'SIGN_IN_FAILED',
        after: { reason },
        entityId: `credential:${loginAuditIdentifier(email)}`,
        entityType: 'Authentication',
      },
    })
    .catch((error: unknown) => {
      logger.error(
        { error, loginIdentifier: loginAuditIdentifier(email), reason },
        'Failed to write credential failure audit event',
      );
    });
}

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
      async authorize(credentials, request) {
        const parsed = loginInputSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const rateLimit = await authLoginRateLimiter.check(
          parsed.data.email,
          request.headers ?? {},
        );
        if (!rateLimit.allowed) {
          await recordFailedSignIn(
            parsed.data.email,
            rateLimit.unavailable
              ? 'AUTH_RATE_LIMIT_UNAVAILABLE'
              : 'RATE_LIMITED',
          );
          return null;
        }

        const user = await database.user.findUnique({
          include: { credential: true },
          where: { email: parsed.data.email },
        });
        if (user === null || user.credential === null) {
          await hashPassword(parsed.data.password);
          await authLoginRateLimiter.recordFailure(
            parsed.data.email,
            request.headers ?? {},
          );
          await recordFailedSignIn(parsed.data.email, 'INVALID_CREDENTIALS');
          return null;
        }
        if (user.status !== 'ACTIVE') {
          await hashPassword(parsed.data.password);
          await authLoginRateLimiter.recordFailure(
            parsed.data.email,
            request.headers ?? {},
          );
          await recordFailedSignIn(parsed.data.email, 'ACCOUNT_INACTIVE');
          return null;
        }

        const valid = await verifyPassword(
          parsed.data.password,
          user.credential.passwordHash,
        );
        if (!valid) {
          await authLoginRateLimiter.recordFailure(
            parsed.data.email,
            request.headers ?? {},
          );
          await recordFailedSignIn(parsed.data.email, 'INVALID_CREDENTIALS');
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
