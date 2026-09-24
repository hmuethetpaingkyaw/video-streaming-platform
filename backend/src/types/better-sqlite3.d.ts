declare module "better-sqlite3" {
  namespace Database {
    interface RunResult {
      changes: number;
      lastInsertRowid: number | bigint;
    }

    interface Statement {
      run(...params: unknown[]): RunResult;
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
    }

    interface Database {
      prepare(sql: string): Statement;
      exec(sql: string): Database;
      transaction<T extends (...args: unknown[]) => unknown>(fn: T): T;
    }
  }

  interface DatabaseConstructor {
    new (filename: string): Database.Database;
  }

  const Database: DatabaseConstructor;
  export = Database;
}
