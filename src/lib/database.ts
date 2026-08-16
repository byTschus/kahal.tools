import mysql from "mysql2/promise";

const globalForDatabase = globalThis as unknown as {
  databasePool?: mysql.Pool;
};

export const database =
  globalForDatabase.databasePool ??
  mysql.createPool({
    uri: process.env.DATABASE_URL,
    connectionLimit: 10,
    enableKeepAlive: true,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.databasePool = database;
}

export async function withTransaction<T>(
  callback: (connection: mysql.PoolConnection) => Promise<T>,
) {
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
