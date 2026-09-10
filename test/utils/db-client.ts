const { Client } = require('pg');

export class DbClient {
  private client: any;

  constructor(config: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  }) {
    this.client = new Client(config);
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.end();
  }

  async query(sql: string, params?: any[]): Promise<any> {
    return this.client.query(sql, params);
  }

  /**
   * Find a contract row by its on-chain address (case-insensitive).
   */
  async getContractByAddress(address: string): Promise<any | null> {
    const result = await this.client.query(
      'SELECT * FROM contract WHERE LOWER(address) = LOWER($1) LIMIT 1',
      [address],
    );
    return result.rows[0] || null;
  }

  /**
   * Find blockchain_event rows by event name, optionally filtered by contract address.
   * Uses JSONB `eventData` column and `eventName` column.
   */
  async getEventsByName(
    eventName: string,
    contractAddress?: string,
  ): Promise<any[]> {
    let sql = 'SELECT * FROM blockchain_event WHERE "eventName" = $1';
    const params: any[] = [eventName];

    if (contractAddress) {
      sql += ' AND "eventData"::text ILIKE $2';
      params.push(`%${contractAddress}%`);
    }

    sql += ' ORDER BY "blockNumber" DESC';
    return (await this.client.query(sql, params)).rows;
  }

  /**
   * Find alerts by type.
   */
  async getAlertsByType(type: string): Promise<any[]> {
    const result = await this.client.query(
      'SELECT * FROM alert WHERE type = $1 ORDER BY id',
      [type],
    );
    return result.rows;
  }

  /**
   * Get the blockchain row for Arbitrum Local.
   */
  async getLocalBlockchain(): Promise<any | null> {
    const result = await this.client.query(
      `SELECT * FROM blockchain WHERE name = 'Arbitrum Local' OR "chainId" = 412346 LIMIT 1`,
    );
    return result.rows[0] || null;
  }

  /**
   * Find an alert by its ID.
   */
  async getAlertById(id: string): Promise<any | null> {
    const result = await this.client.query(
      'SELECT * FROM alert WHERE id = $1',
      [id],
    );
    return result.rows[0] || null;
  }

  /**
   * Find alerts linked to a specific user_contract row.
   */
  async getAlertsByUserContract(userContractId: string): Promise<any[]> {
    const result = await this.client.query(
      'SELECT * FROM alert WHERE "userContractId" = $1 ORDER BY type',
      [userContractId],
    );
    return result.rows;
  }

  /**
   * Find the user_contract row for a given contract address and user.
   */
  async getUserContract(
    contractAddress: string,
    userAddress: string,
  ): Promise<any | null> {
    const result = await this.client.query(
      `SELECT uc.* FROM user_contract uc
       JOIN contract c ON uc."contractId" = c.id
       JOIN "user" u ON uc."userId" = u.id
       WHERE LOWER(c.address) = LOWER($1)
         AND LOWER(u.address) = LOWER($2)
       LIMIT 1`,
      [contractAddress, userAddress],
    );
    return result.rows[0] || null;
  }

  /**
   * Count blockchain_event rows matching a name and optionally containing
   * a contract address in the data field.
   */
  async countEvents(
    eventName: string,
    contractAddress?: string,
  ): Promise<number> {
    let sql = 'SELECT COUNT(*) FROM blockchain_event WHERE "eventName" = $1';
    const params: any[] = [eventName];

    if (contractAddress) {
      sql += ' AND "eventData"::text ILIKE $2';
      params.push(`%${contractAddress}%`);
    }

    const result = await this.client.query(sql, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Check if a contract's bytecode is marked as cached.
   * Joins contract -> bytecode to read bytecode.isCached.
   */
  async isContractBytecodeCached(address: string): Promise<boolean> {
    const result = await this.client.query(
      `SELECT b."isCached" FROM contract c
       JOIN bytecode b ON c."bytecodeId" = b.id
       WHERE LOWER(c.address) = LOWER($1)
       LIMIT 1`,
      [address],
    );
    if (result.rows.length === 0) return false;
    return result.rows[0].isCached === true;
  }
}
