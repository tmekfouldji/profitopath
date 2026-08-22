import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const algorithm = 'scrypt-v1';
const cost = 16_384;
const blockSize = 8;
const parallelization = 1;
const keyLength = 64;
const maxMemory = 32 * 1024 * 1024;

function deriveKey(
  password: string,
  salt: Buffer,
  parameters: { cost: number; blockSize: number; parallelization: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      keyLength,
      {
        N: parameters.cost,
        maxmem: maxMemory,
        p: parameters.parallelization,
        r: parameters.blockSize,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await deriveKey(password, salt, {
    blockSize,
    cost,
    parallelization,
  });

  return [
    algorithm,
    cost,
    blockSize,
    parallelization,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const [
    version,
    costValue,
    blockSizeValue,
    parallelizationValue,
    saltValue,
    hashValue,
  ] = encodedHash.split('$');
  if (
    version !== algorithm ||
    costValue === undefined ||
    blockSizeValue === undefined ||
    parallelizationValue === undefined ||
    saltValue === undefined ||
    hashValue === undefined
  ) {
    return false;
  }

  const storedHash = Buffer.from(hashValue, 'base64url');
  if (storedHash.length !== keyLength) {
    return false;
  }

  try {
    const derivedKey = await deriveKey(
      password,
      Buffer.from(saltValue, 'base64url'),
      {
        blockSize: Number(blockSizeValue),
        cost: Number(costValue),
        parallelization: Number(parallelizationValue),
      },
    );
    return timingSafeEqual(storedHash, derivedKey);
  } catch {
    return false;
  }
}
