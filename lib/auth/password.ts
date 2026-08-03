import bcrypt from "bcryptjs"

const bcryptRounds = 12

export const dummyPasswordHash =
  "$2b$12$d3uoJTV91sBUau4pJaUjT.j/i1Ry.hnu2yJKpUnJatLJIsGOtILVa"

export function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, bcryptRounds)
}

export function verifyPassword(
  plainPassword: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash)
}
