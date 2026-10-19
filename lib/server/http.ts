import 'server-only';
import { NextResponse } from 'next/server';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Wrap a route handler: JSON out, HttpError → status, anything else → 500 */
export function handler<A extends unknown[]>(fn: (req: Request, ...args: A) => Promise<unknown>) {
  return async (req: Request, ...args: A) => {
    try {
      return NextResponse.json(await fn(req, ...args), { headers: { 'Cache-Control': 'no-store' } });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: 'server error' }, { status: 500 });
    }
  };
}

export async function body<T = any>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'bad json');
  }
}
