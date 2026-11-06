import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Property } from './property.entity';

@Entity('property_images')
@Unique('UQ_property_images_position', ['propertyId', 'position'])
export class PropertyImage {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Index()
    @Column('uuid')
    propertyId!: string;

    @ManyToOne(() => Property, (property) => property.images, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'propertyId' })
    property!: Property;

    @Column()
    url!: string;

    @Column()
    publicId!: string;

    @Column({ default: 0 })
    position!: number;

    @CreateDateColumn()
    createdAt!: Date;
}
