import { Role } from '../enums';

export interface Requester {
    userId: string;
    role: Role;
}
