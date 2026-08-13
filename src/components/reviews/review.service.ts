import { DolphServiceHandler } from '@dolphjs/dolph/classes';
import { Dolph } from '@dolphjs/dolph/common';
import { DService } from '@dolphjs/dolph/decorators';
import { getDataSource } from '@dolphjs/dolph/packages/typeorm';
import { PaginationDto } from '../../shared/dto';
import { CreateReviewDto, UpdateReviewDto } from './review.dto';
import { Review } from './review.entity';

export interface RatingAggregate {
    averageRating: number;
    reviewCount: number;
}

export interface ReviewListResult {
    data: Review[];
    total: number;
    page: number;
    limit: number;
}

@DService()
export class ReviewService extends DolphServiceHandler<Dolph> {
    constructor() {
        super('reviewService');
    }

    private get repo() {
        return getDataSource().getRepository(Review);
    }

    async create(propertyId: string, userId: string, dto: CreateReviewDto): Promise<Review> {
        const review = this.repo.create({ propertyId, userId, ...dto });
        return this.repo.save(review);
    }

    async findById(id: string): Promise<Review | null> {
        return this.repo.findOne({ where: { id } });
    }

    async findByPropertyAndUser(propertyId: string, userId: string): Promise<Review | null> {
        return this.repo.findOne({ where: { propertyId, userId } });
    }

    async listForProperty(propertyId: string, pagination: PaginationDto): Promise<ReviewListResult> {
        const [data, total] = await this.repo.findAndCount({
            where: { propertyId },
            order: { createdAt: pagination.order },
            skip: (pagination.page - 1) * pagination.limit,
            take: pagination.limit,
        });

        return { data, total, page: pagination.page, limit: pagination.limit };
    }

    async update(id: string, dto: UpdateReviewDto): Promise<Review> {
        await this.repo.update({ id }, dto);
        return (await this.findById(id))!;
    }

    async softDelete(id: string): Promise<void> {
        await this.repo.softDelete({ id });
    }

    async getAggregatesForProperties(propertyIds: string[]): Promise<Map<string, RatingAggregate>> {
        const map = new Map<string, RatingAggregate>();
        if (propertyIds.length === 0) return map;

        const rows = await this.repo
            .createQueryBuilder('review')
            .select('review.propertyId', 'propertyId')
            .addSelect('AVG(review.rating)', 'averageRating')
            .addSelect('COUNT(review.id)', 'reviewCount')
            .where('review.propertyId IN (:...propertyIds)', { propertyIds })
            .groupBy('review.propertyId')
            .getRawMany();

        for (const row of rows) {
            map.set(row.propertyId, {
                averageRating: parseFloat(row.averageRating),
                reviewCount: parseInt(row.reviewCount, 10),
            });
        }

        return map;
    }

    async getAggregateForProperty(propertyId: string): Promise<RatingAggregate> {
        const map = await this.getAggregatesForProperties([propertyId]);
        return map.get(propertyId) ?? { averageRating: 0, reviewCount: 0 };
    }
}
