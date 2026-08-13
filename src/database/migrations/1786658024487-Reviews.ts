import { MigrationInterface, QueryRunner } from "typeorm";

export class Reviews1786658024487 implements MigrationInterface {
    name = 'Reviews1786658024487'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "propertyId" uuid NOT NULL, "userId" uuid NOT NULL, "rating" integer NOT NULL, "comment" text NOT NULL, CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2c75ccf95bf502363885d076e7" ON "reviews"  ("propertyId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7ed5659e7139fc8bc039198cc1" ON "reviews"  ("userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a7d578531d8973863a012af431" ON "reviews"  ("propertyId", "userId") `);
        await queryRunner.query(`ALTER TABLE "reviews" ADD CONSTRAINT "FK_2c75ccf95bf502363885d076e76" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reviews" ADD CONSTRAINT "FK_7ed5659e7139fc8bc039198cc1f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT "FK_7ed5659e7139fc8bc039198cc1f"`);
        await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT "FK_2c75ccf95bf502363885d076e76"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a7d578531d8973863a012af431"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7ed5659e7139fc8bc039198cc1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2c75ccf95bf502363885d076e7"`);
        await queryRunner.query(`DROP TABLE "reviews"`);
    }

}
