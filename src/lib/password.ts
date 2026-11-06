import { hash, verify } from "@node-rs/argon2";

// argon2id с параметрами OWASP (19 MiB, 2 итерации). Пароль в открытом виде нигде не хранится и не логируется.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(plain: string) {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(hashed: string, plain: string) {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}

// Хеш-заглушка: проверяем пароль даже для несуществующего логина, чтобы время ответа не выдавало, есть ли такой пользователь.
let dummy: Promise<string> | null = null;
export function dummyHash() {
  dummy ??= hashPassword("timing-safe-dummy");
  return dummy;
}
