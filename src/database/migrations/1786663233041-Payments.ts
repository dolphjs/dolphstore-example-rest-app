import { MigrationInterface, QueryRunner } from "typeorm";

export class Payments1786663233041 implements MigrationInterface {
    name = 'Payments1786663233041'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."payments_status_enum" AS ENUM('pending', 'paid', 'failed', 'refunded')`);
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "propertyId" uuid NOT NULL, "agentId" uuid NOT NULL, "reference" character varying NOT NULL, "providerReference" character varying, "amount" integer NOT NULL, "currency" character varying NOT NULL DEFAULT 'NGN', "featureDurationDays" integer NOT NULL, "status" "public"."payments_status_enum" NOT NULL DEFAULT 'pending', "checkoutUrl" character varying, "paidAt" TIMESTAMP, "refundedAt" TIMESTAMP, "refundReason" character varying, CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8ffcbb107170ed65322ac59fd6" ON "payments"  ("propertyId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ae67b32be4b3185775ae72db68" ON "payments"  ("agentId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_866ddee0e17d9385b4e3b86851" ON "payments"  ("reference") `);
        await queryRunner.query(`CREATE INDEX "IDX_32b41cdb985a296213e9a928b5" ON "payments"  ("status") `);
        await queryRunner.query(`ALTER TABLE "properties" ADD "featuredUntil" TIMESTAMP`);
        await queryRunner.query(`CREATE INDEX "IDX_f4a10968ec60136a0905afde1a" ON "properties"  ("featuredUntil") `);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_8ffcbb107170ed65322ac59fd6e" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_ae67b32be4b3185775ae72db688" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_ae67b32be4b3185775ae72db688"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_8ffcbb107170ed65322ac59fd6e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f4a10968ec60136a0905afde1a"`);
        await queryRunner.query(`ALTER TABLE "properties" DROP COLUMN "featuredUntil"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_32b41cdb985a296213e9a928b5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_866ddee0e17d9385b4e3b86851"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ae67b32be4b3185775ae72db68"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8ffcbb107170ed65322ac59fd6"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
    }

}
