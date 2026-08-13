import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Property } from './property.entity';

@Entity('property_images')
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
