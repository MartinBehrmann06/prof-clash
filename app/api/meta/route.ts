import { handler } from '@/lib/server/http';
import { getMeta } from '@/lib/server/catalog';

export const GET = handler(getMeta);
