import { Contact } from "@clinq/bridge";
import * as redis from "redis";
import { anonymizeKey } from "../util/anonymize-key";
import { PromiseRedisClient } from "./promise-redis-client";

const CACHE_TTL = 60 * 60 * 24 * 30; // 30 days

export class RedisCache {
	private client: PromiseRedisClient;

	constructor(url: string) {
		const client = redis.createClient({
			url
		});
		this.client = new PromiseRedisClient(client);
		console.log("Initialized Redis cache.");
		client.on("error", error => {
			console.warn("Redis error: ", error.message);
		});
	}

	public async get(key: string): Promise<Contact[] | null> {
		const value = await this.client.get(key);
		if (value) {
			return JSON.parse(value) as Contact[];
		} else {
			console.log(`Found no match for key "${anonymizeKey(key)}" in cache.`);
			return null;
		}
	}

	public async delete(key: string): Promise<void> {
		console.log(`Removing contacts for key "${anonymizeKey(key)}" from cache.`);
		await this.client.del(key);
	}

	public async set(key: string, value: any): Promise<void> {
		const stringified = JSON.stringify(value);
		console.log(`Saving contacts for key "${anonymizeKey(key)}" to cache.`);
		await this.client.set(key, stringified, "EX", CACHE_TTL);
	}
}
