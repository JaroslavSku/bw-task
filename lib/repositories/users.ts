import { getPool } from "@/lib/db"

export interface UserRecord {
  id: number
  email: string
  passwordHash: string
}

interface UserRow {
  id: number
  email: string
  password_hash: string
}

function mapUserRow(row: UserRow): UserRecord {
  return { id: row.id, email: row.email, passwordHash: row.password_hash }
}

export async function createUser(
  email: string,
  passwordHash: string,
): Promise<UserRecord | null> {
  const result = await getPool().query<UserRow>(
    `insert into users (email, password_hash)
         values ($1, $2)
         on conflict (email) do nothing
         returning id, email, password_hash`,
    [email, passwordHash],
  )
  const row = result.rows[0]
  return row ? mapUserRow(row) : null
}

export async function findUserByEmail(
  email: string,
): Promise<UserRecord | null> {
  const result = await getPool().query<UserRow>(
    "select id, email, password_hash from users where email = $1",
    [email],
  )
  const row = result.rows[0]
  return row ? mapUserRow(row) : null
}

export async function findUserById(userId: number): Promise<UserRecord | null> {
  const result = await getPool().query<UserRow>(
    "select id, email, password_hash from users where id = $1",
    [userId],
  )
  const row = result.rows[0]
  return row ? mapUserRow(row) : null
}
