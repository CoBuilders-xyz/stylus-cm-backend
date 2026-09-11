import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * CMA v2.0: adds Contract.biddingEnabled (see PR #85).
 *
 * First migration in the repository. Databases that run with synchronize on
 * (local, develop) do not run migrations, so this is only ever applied to a
 * database without the column. If it is run against a synced database by
 * mistake, it fails on the duplicate column instead of recording a migration
 * it did not perform.
 */
export class AddContractBiddingEnabled1788892847685
  implements MigrationInterface
{
  name = 'AddContractBiddingEnabled1788892847685';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'contract',
      new TableColumn({
        name: 'biddingEnabled',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('contract', 'biddingEnabled');
  }
}
