export function GET(): Response {
  return Response.json({ checkedAt: new Date().toISOString(), status: 'ok' });
}
