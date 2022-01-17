import * as redis from 'redis';

class RedisClient {
  constructor() {
    this.client = redis.createClient();
    this.client.on('error', (err) => console.error('Redis client not connected to the server:', err));
    this._is_alive = false;
    this.client.on('ready', () => { this._is_alive = true; });
  }

  isAlive() { return this._is_alive; }

  async init() { return this.client.connect(); }

  async get(key) {
    try {
      return this.client.get(key);
    } catch (err) {
      console.error(err);
      return undefined;
    }
  }

  async set(key, value, duration) {
    try {
      return this.client.set(key, value, {
        EX: duration,
      });
    } catch (err) {
      console.error(err);
      return undefined;
    }
  }

  async del(key) {
    try {
      return this.client.del(key);
    } catch (err) {
      console.error(err);
      return undefined;
    }
  }
}

const redisClient = new RedisClient();
redisClient.init();

export default redisClient;
