import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AbstractEntity } from '../../shared/entities/abstract.entity';
import { User } from '../iam/user.entity';
import { PropertyImage } from './property-image.entity';
import { ListingStatus, ListingType, PropertyType } from './property.enums';

const decimalTransformer = {
    to: (value?: number) => value,
    from: (value?: string) => (value === null || value === undefined ? value : parseFloat(value)),
};

@Entity('properties')
export class Property extends AbstractEntity {
    @Column()
    title!: string;

    @Column('text')
    description!: string;

    @Column({ type: 'decimal', precision: 14, scale: 2, transformer: decimalTransformer })
    price!: number;

    @Column({ default: 'NGN' })
    currency!: string;

    @Column({ type: 'simple-enum', enum: ListingType })
    listingType!: ListingType;

    @Column({ type: 'simple-enum', enum: PropertyType })
    propertyType!: PropertyType;

    @Column({ default: 0 })
    bedrooms!: number;

    @Column({ default: 0 })
    bathrooms!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: decimalTransformer })
    areaSqm!: number | null;

    @Column()
    address!: string;

    @Index()
    @Column()
    city!: string;

    @Index()
    @Column()
    state!: string;

    @Column({ default: 'Nigeria' })
    country!: string;

    @Index()
    @Column({ type: 'simple-enum', enum: ListingStatus, default: ListingStatus.DRAFT })
    status!: ListingStatus;

    @Index()
    @Column('uuid')
    agentId!: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'agentId' })
    agent!: User;

    @OneToMany(() => PropertyImage, (image) => image.property)
    images!: PropertyImage[];
}
