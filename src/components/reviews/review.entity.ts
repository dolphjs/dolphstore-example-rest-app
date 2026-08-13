import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from '../../shared/entities/abstract.entity';
import { User } from '../iam/user.entity';
import { Property } from '../properties/property.entity';

@Entity('reviews')
@Index(['propertyId', 'userId'], { unique: true })
export class Review extends AbstractEntity {
    @Index()
    @Column('uuid')
    propertyId!: string;

    @ManyToOne(() => Property, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'propertyId' })
    property!: Property;

    @Index()
    @Column('uuid')
    userId!: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user!: User;

    @Column('int')
    rating!: number;

    @Column('text')
    comment!: string;
}
