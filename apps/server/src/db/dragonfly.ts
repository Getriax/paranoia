import { Redis } from 'ioredis';

export const dragonfly = new Redis(process.env.DRAGONFLY_URL!, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});
