import { timingSafeEqual } from "node:crypto";

export function privateSyncAuthorized(request: Request, expected: string | undefined): boolean {
  if (!expected) return false;
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  const supplied = new TextEncoder().encode(authorization.slice(7));
  const wanted = new TextEncoder().encode(expected);
  return supplied.byteLength === wanted.byteLength && timingSafeEqual(supplied, wanted);
}
