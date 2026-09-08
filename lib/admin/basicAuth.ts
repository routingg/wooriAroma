/** Shared by the edge middleware and server authorization checks. */
export function checkAdminBasicAuth(header: string | null): boolean {
  const expectedUser = process.env.ADMIN_BASIC_AUTH_USER;
  const expectedPassword = process.env.ADMIN_BASIC_AUTH_PASSWORD;
  if (!expectedUser || !expectedPassword || !header?.startsWith("Basic ") || header.length > 4096) {
    return false;
  }

  let decoded: string;
  try {
    decoded = atob(header.slice("Basic ".length));
  } catch {
    return false;
  }
  const expected = `${expectedUser}:${expectedPassword}`;
  let difference = decoded.length ^ expected.length;
  for (let index = 0; index < expected.length; index++) {
    difference |= (decoded.charCodeAt(index) || 0) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}
