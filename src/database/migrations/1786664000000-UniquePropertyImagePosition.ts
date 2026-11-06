import { MigrationInterface, QueryRunner } from "typeorm";

export class UniquePropertyImagePosition1786664000000 implements MigrationInterface {
    name = 'UniquePropertyImagePosition1786664000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Positions used to come from a count, so existing rows can share one.
        await queryRunner.query(`UPDATE "property_images" AS image SET "position" = ranked.position FROM (SELECT "id", ROW_NUMBER() OVER (PARTITION BY "propertyId" ORDER BY "position", "createdAt") - 1 AS position FROM "property_images") AS ranked WHERE image."id" = ranked."id"`);
        await queryRunner.query(`ALTER TABLE "property_images" ADD CONSTRAINT "UQ_property_images_position" UNIQUE ("propertyId", "position")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "property_images" DROP CONSTRAINT "UQ_property_images_position"`);
    }
}
