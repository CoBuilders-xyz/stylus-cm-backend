import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Stylus activations (PR #80) and the activation alert types (PR #83).
 *
 * These entity changes reached staging while the schema was still managed by
 * TypeORM `synchronize`, so they never got a migration. Production runs with
 * sync off and therefore still has the pre-activation schema. This migration
 * closes that gap:
 *
 * - Contract: autoActivate, maxActivationCost, lastActivationBlockNumber,
 *   lastActivationTimestamp, activationStatus, activationRetryCount.
 * - Alert.type enum: approachingExpiration, expired, reactivationSucceeded,
 *   reactivationFailed.
 *
 * Postgres cannot remove enum values, so the enum is rebuilt (rename old type,
 * create the new one, retype the column, drop the old type). This is the same
 * SQL `migration:generate` emits. `down` fails if any alert row already uses
 * one of the new types; delete or retype those rows first instead of losing
 * them silently.
 *
 * A database that already has these columns from `synchronize` (staging) must
 * be baselined instead of migrated: see README "Database migrations".
 */
export class AddContractActivationColumns1789067652021
  implements MigrationInterface
{
  name = 'AddContractActivationColumns1789067652021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contract" ADD "autoActivate" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "contract" ADD "maxActivationCost" character varying(78)`,
    );
    await queryRunner.query(
      `ALTER TABLE "contract" ADD "lastActivationBlockNumber" bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "contract" ADD "lastActivationTimestamp" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "contract" ADD "activationStatus" character varying DEFAULT 'unknown'`,
    );
    await queryRunner.query(
      `ALTER TABLE "contract" ADD "activationRetryCount" integer NOT NULL DEFAULT '0'`,
    );

    await queryRunner.query(
      `ALTER TYPE "public"."alert_type_enum" RENAME TO "alert_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."alert_type_enum" AS ENUM('eviction', 'noGas', 'lowGas', 'bidSafety', 'approachingExpiration', 'expired', 'reactivationSucceeded', 'reactivationFailed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert" ALTER COLUMN "type" TYPE "public"."alert_type_enum" USING "type"::"text"::"public"."alert_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."alert_type_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."alert_type_enum_old" AS ENUM('eviction', 'noGas', 'lowGas', 'bidSafety')`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert" ALTER COLUMN "type" TYPE "public"."alert_type_enum_old" USING "type"::"text"::"public"."alert_type_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."alert_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."alert_type_enum_old" RENAME TO "alert_type_enum"`,
    );

    await queryRunner.query(
      `ALTER TABLE "contract" DROP COLUMN "activationRetryCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contract" DROP COLUMN "activationStatus"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contract" DROP COLUMN "lastActivationTimestamp"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contract" DROP COLUMN "lastActivationBlockNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contract" DROP COLUMN "maxActivationCost"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contract" DROP COLUMN "autoActivate"`,
    );
  }
}
