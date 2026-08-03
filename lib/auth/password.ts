import bcrypt from "bcryptjs"

const bcryptRounds = 12

export function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, bcryptRounds)
}

export function verifyPassword(
  plainPassword: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash)
}
