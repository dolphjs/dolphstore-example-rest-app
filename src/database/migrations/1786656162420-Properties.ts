import { MigrationInterface, QueryRunner } from "typeorm";

export class Properties1786656162420 implements MigrationInterface {
    name = 'Properties1786656162420'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."properties_listingtype_enum" AS ENUM('sale', 'rent')`);
        await queryRunner.query(`CREATE TYPE "public"."properties_propertytype_enum" AS ENUM('apartment', 'house', 'land', 'commercial')`);
        await queryRunner.query(`CREATE TYPE "public"."properties_status_enum" AS ENUM('draft', 'published', 'archived')`);
        await queryRunner.query(`CREATE TABLE "properties" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "title" character varying NOT NULL, "description" text NOT NULL, "price" numeric(14,2) NOT NULL, "currency" character varying NOT NULL DEFAULT 'NGN', "listingType" "public"."properties_listingtype_enum" NOT NULL, "propertyType" "public"."properties_propertytype_enum" NOT NULL, "bedrooms" integer NOT NULL DEFAULT '0', "bathrooms" integer NOT NULL DEFAULT '0', "areaSqm" numeric(10,2), "address" character varying NOT NULL, "city" character varying NOT NULL, "state" character varying NOT NULL, "country" character varying NOT NULL DEFAULT 'Nigeria', "status" "public"."properties_status_enum" NOT NULL DEFAULT 'draft', "agentId" uuid NOT NULL, CONSTRAINT "PK_2d83bfa0b9fcd45dee1785af44d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c7aea7f222acdb48e3422361f8" ON "properties"  ("city") `);
        await queryRunner.query(`CREATE INDEX "IDX_aaad1f1a0a66a307c3fb02e519" ON "properties"  ("state") `);
        await queryRunner.query(`CREATE INDEX "IDX_9cd2513cd04f57c9967f640b0a" ON "properties"  ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_353db6091069783cf1673cc82f" ON "properties"  ("agentId") `);
        await queryRunner.query(`CREATE TABLE "property_images" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "propertyId" uuid NOT NULL, "url" character varying NOT NULL, "publicId" character varying NOT NULL, "position" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_317c3774ee70c26d70c4f80e200" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7a07b6b7f9418bf1d516010669" ON "property_images"  ("propertyId") `);
        await queryRunner.query(`ALTER TABLE "properties" ADD CONSTRAINT "FK_353db6091069783cf1673cc82f6" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "property_images" ADD CONSTRAINT "FK_7a07b6b7f9418bf1d5160106694" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "property_images" DROP CONSTRAINT "FK_7a07b6b7f9418bf1d5160106694"`);
        await queryRunner.query(`ALTER TABLE "properties" DROP CONSTRAINT "FK_353db6091069783cf1673cc82f6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7a07b6b7f9418bf1d516010669"`);
        await queryRunner.query(`DROP TABLE "property_images"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_353db6091069783cf1673cc82f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9cd2513cd04f57c9967f640b0a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aaad1f1a0a66a307c3fb02e519"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c7aea7f222acdb48e3422361f8"`);
        await queryRunner.query(`DROP TABLE "properties"`);
        await queryRunner.query(`DROP TYPE "public"."properties_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."properties_propertytype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."properties_listingtype_enum"`);
    }

}
