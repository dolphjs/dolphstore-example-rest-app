import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('email_verification_codes')
export class EmailVerificationCode {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Index()
    @Column('uuid')
    userId!: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user!: User;

    @Column()
    codeHash!: string;

    @Column()
    expiresAt!: Date;

    @Column({ default: 0 })
    attempts!: number;

    @Column({ nullable: true })
    consumedAt!: Date | null;

    @CreateDateColumn()
    createdAt!: Date;
}
