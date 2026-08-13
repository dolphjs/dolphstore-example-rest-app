import { DolphServiceHandler } from '@dolphjs/dolph/classes';
import { Dolph, ForbiddenException, NotFoundException } from '@dolphjs/dolph/common';
import { DService } from '@dolphjs/dolph/decorators';
import { Role } from '../../shared/enums';
import { PropertyImageService } from './property-image.service';
import { CreatePropertyDto, SearchPropertiesDto, UpdatePropertyDto } from './property.dto';
import { Property } from './property.entity';
import { ListingStatus } from './property.enums';
import { PropertyService } from './property.service';

export interface Requester {
    userId: string;
    role: Role;
}

@DService()
export class PropertiesService extends DolphServiceHandler<Dolph> {
    constructor(
        private propertyService: PropertyService,
        private propertyImageService: PropertyImageService,
    ) {
        super('propertiesService');
    }

    async create(agentId: string, dto: CreatePropertyDto): Promise<Property> {
        return this.propertyService.create(agentId, dto);
    }

    async search(query: SearchPropertiesDto) {
        return this.propertyService.search(query, { onlyPublished: true });
    }

    async findPublished(id: string): Promise<Property> {
        const property = await this.propertyService.findById(id);
        if (!property || property.status !== ListingStatus.PUBLISHED) {
            throw new NotFoundException('property not found');
        }
        return property;
    }

    async findMine(requester: Requester, query: SearchPropertiesDto) {
        return this.propertyService.search(query, { onlyPublished: false, agentId: requester.userId });
    }

    async update(id: string, requester: Requester, dto: UpdatePropertyDto): Promise<Property> {
        await this.assertOwnership(id, requester);
        return this.propertyService.update(id, dto);
    }

    async remove(id: string, requester: Requester): Promise<void> {
        const property = await this.assertOwnership(id, requester);
        for (const image of property.images) {
            await this.propertyImageService.remove(image.id);
        }
        await this.propertyService.softDelete(property.id);
    }

    async addImage(id: string, requester: Requester, buffer: Buffer) {
        await this.assertOwnership(id, requester);
        return this.propertyImageService.upload(id, buffer);
    }

    async removeImage(propertyId: string, imageId: string, requester: Requester): Promise<void> {
        await this.assertOwnership(propertyId, requester);

        const image = await this.propertyImageService.findById(imageId);
        if (!image || image.propertyId !== propertyId) {
            throw new NotFoundException('image not found');
        }

        await this.propertyImageService.remove(imageId);
    }

    private async assertOwnership(id: string, requester: Requester): Promise<Property> {
        const property = await this.propertyService.findById(id);
        if (!property) throw new NotFoundException('property not found');

        if (property.agentId !== requester.userId && requester.role !== Role.ADMIN) {
            throw new ForbiddenException('you do not own this property');
        }

        return property;
    }
}
