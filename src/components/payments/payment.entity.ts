import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from '../../shared/entities/abstract.entity';
import { User } from '../iam/user.entity';
import { Property } from '../properties/property.entity';
import { PaymentStatus } from './payment.enums';

@Entity('payments')
export class Payment extends AbstractEntity {
    @Index()
    @Column('uuid')
    propertyId!: string;

    @ManyToOne(() => Property)
    @JoinColumn({ name: 'propertyId' })
    property!: Property;

    @Index()
    @Column('uuid')
    agentId!: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'agentId' })
    agent!: User;

    @Index({ unique: true })
    @Column()
    reference!: string;

    @Column({ nullable: true })
    providerReference!: string | null;

    @Column('int')
    amount!: number;

    @Column({ default: 'NGN' })
    currency!: string;

    @Column('int')
    featureDurationDays!: number;

    @Index()
    @Column({ type: 'simple-enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
    status!: PaymentStatus;

    @Column({ nullable: true })
    checkoutUrl!: string | null;

    @Column({ nullable: true })
    paidAt!: Date | null;

    @Column({ nullable: true })
    refundedAt!: Date | null;

    @Column({ nullable: true })
    refundReason!: string | null;
}
