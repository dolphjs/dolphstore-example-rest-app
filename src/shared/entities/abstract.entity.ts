import { CreateDateColumn, DeleteDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Every domain entity (Property, User, Booking, ...) extends this instead of
 * redeclaring id/timestamps/soft-delete by hand. `deletedAt` opts every
 * entity into TypeORM's soft-delete (`softRemove`/`restore`) — listings and
 * bookings should be recoverable, not hard-deleted, by default.
 *
 * Named `AbstractEntity`, not `BaseEntity`, to avoid colliding with
 * TypeORM's own exported `BaseEntity` (the Active Record base class) —
 * this codebase uses the Repository pattern instead.
 */
export abstract class AbstractEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;

    @DeleteDateColumn({ type: 'timestamptz', nullable: true })
    deletedAt: Date | null;
}
