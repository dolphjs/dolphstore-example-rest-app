import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../shared/entities/abstract.entity';
import { Role } from '../../shared/enums';

@Entity('users')
export class User extends AbstractEntity {
    @Index({ unique: true })
    @Column()
    email!: string;

    @Column({ select: false })
    password!: string;

    @Column()
    firstName!: string;

    @Column()
    lastName!: string;

    @Column()
    phone!: string;

    @Column({ type: 'simple-enum', enum: Role, default: Role.USER })
    role!: Role;
}
