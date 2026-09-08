import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * CMA v2.0: adds Contract.biddingEnabled (see PR #85).
 *
 * First migration in the repository. Every environment before this point was
 * created by TypeORM synchronize, so the column may already exist on
 * databases that ran with sync on. `up` is therefore idempotent.
 */
export class AddContractBiddingEnabled1788892847685
  implements MigrationInterface
{
  name = 'AddContractBiddingEnabled1788892847685';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('contract', 'biddingEnabled');
    if (hasColumn) {
      return;
    }

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
