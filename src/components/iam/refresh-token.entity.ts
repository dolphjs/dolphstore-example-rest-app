import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from './user.entity';


@Entity('refresh_tokens')
export class RefreshToken {
    @PrimaryColumn('uuid')
    id!: string;

    @Index()
    @Column('uuid')
    userId!: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user!: User;

    @Column()
    tokenHash!: string;

    @Column({ nullable: true })
    userAgent?: string | null;

    @Column()
    expiresAt!: Date;

    @Column({ nullable: true })
    revokedAt?: Date | null;

    @CreateDateColumn()
    createdAt!: Date;
}
