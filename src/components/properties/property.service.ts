import { DolphServiceHandler } from '@dolphjs/dolph/classes';
import { Dolph } from '@dolphjs/dolph/common';
import { DService } from '@dolphjs/dolph/decorators';
import { getDataSource } from '@dolphjs/dolph/packages/typeorm';
import { CreatePropertyDto, SearchPropertiesDto, UpdatePropertyDto } from './property.dto';
import { ListingStatus } from './property.enums';
import { Property } from './property.entity';

export interface PropertySearchOptions {
    onlyPublished: boolean;
    agentId?: string;
}

export interface PropertySearchResult {
    data: Property[];
    total: number;
    page: number;
    limit: number;
}

@DService()
export class PropertyService extends DolphServiceHandler<Dolph> {
    constructor() {
        super('propertyService');
    }

    private get repo() {
        return getDataSource().getRepository(Property);
    }

    async create(agentId: string, dto: CreatePropertyDto): Promise<Property> {
        const property = this.repo.create({ ...dto, agentId, status: ListingStatus.DRAFT });
        return this.repo.save(property);
    }

    async findById(id: string): Promise<Property | null> {
        return this.repo.findOne({ where: { id }, relations: { images: true } });
    }

    async search(query: SearchPropertiesDto, options: PropertySearchOptions): Promise<PropertySearchResult> {
        const qb = this.repo.createQueryBuilder('property').leftJoinAndSelect('property.images', 'images');

        if (options.onlyPublished) qb.andWhere('property.status = :status', { status: ListingStatus.PUBLISHED });
        if (options.agentId) qb.andWhere('property.agentId = :agentId', { agentId: options.agentId });
        if (query.city) qb.andWhere('LOWER(property.city) LIKE LOWER(:city)', { city: `%${query.city}%` });
        if (query.state) qb.andWhere('LOWER(property.state) LIKE LOWER(:state)', { state: `%${query.state}%` });
        if (query.listingType) qb.andWhere('property.listingType = :listingType', { listingType: query.listingType });
        if (query.propertyType) qb.andWhere('property.propertyType = :propertyType', { propertyType: query.propertyType });
        if (query.minPrice !== undefined) qb.andWhere('property.price >= :minPrice', { minPrice: query.minPrice });
        if (query.maxPrice !== undefined) qb.andWhere('property.price <= :maxPrice', { maxPrice: query.maxPrice });
        if (query.minBedrooms !== undefined) qb.andWhere('property.bedrooms >= :minBedrooms', { minBedrooms: query.minBedrooms });

        qb.orderBy('property.createdAt', query.order)
            .skip((query.page - 1) * query.limit)
            .take(query.limit);

        const [data, total] = await qb.getManyAndCount();
        return { data, total, page: query.page, limit: query.limit };
    }

    async update(id: string, dto: UpdatePropertyDto): Promise<Property> {
        await this.repo.update({ id }, dto);
        return (await this.findById(id))!;
    }

    async softDelete(id: string): Promise<void> {
        await this.repo.softDelete({ id });
    }
}
