export function anonymizeKey(key: string): string {
	return `${key.substr(0, 10)}(...)`;
}
