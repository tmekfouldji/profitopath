import { consumeEmailVerificationToken } from '@/server/email-verification';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const form = await request.formData();
  const token = form.get('token');
  const result = await consumeEmailVerificationToken(
    typeof token === 'string' ? token : '',
  );
  const destination = new URL(
    result === 'verified'
      ? '/login?notice=email-verified'
      : result === 'already_verified'
        ? '/login?notice=email-already-verified'
        : '/verify-email?status=invalid',
    request.url,
  );
  return Response.redirect(destination, 303);
}
