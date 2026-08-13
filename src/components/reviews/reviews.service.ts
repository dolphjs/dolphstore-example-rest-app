import { DolphServiceHandler } from '@dolphjs/dolph/classes';
import { ConflictException, Dolph, ForbiddenException, NotFoundException } from '@dolphjs/dolph/common';
import { DService } from '@dolphjs/dolph/decorators';
import { PaginationDto } from '../../shared/dto';
import { Role } from '../../shared/enums';
import { Requester } from '../../shared/interfaces';
import { PropertyService } from '../properties/property.service';
import { ListingStatus } from '../properties/property.enums';
import { CreateReviewDto, UpdateReviewDto } from './review.dto';
import { Review } from './review.entity';
import { ReviewService } from './review.service';

@DService()
export class ReviewsService extends DolphServiceHandler<Dolph> {
    constructor(
        private reviewService: ReviewService,
        private propertyService: PropertyService,
    ) {
        super('reviewsService');
    }

    async create(propertyId: string, requester: Requester, dto: CreateReviewDto): Promise<Review> {
        const property = await this.findPublishedProperty(propertyId);

        if (property.agentId === requester.userId) {
            throw new ForbiddenException('you cannot review your own property');
        }

        const existing = await this.reviewService.findByPropertyAndUser(propertyId, requester.userId);
        if (existing) {
            throw new ConflictException('you have already reviewed this property');
        }

        return this.reviewService.create(propertyId, requester.userId, dto);
    }

    async list(propertyId: string, pagination: PaginationDto) {
        await this.findPublishedProperty(propertyId);
        return this.reviewService.listForProperty(propertyId, pagination);
    }

    async update(id: string, requester: Requester, dto: UpdateReviewDto): Promise<Review> {
        const review = await this.assertOwnership(id, requester);
        return this.reviewService.update(review.id, dto);
    }

    async remove(id: string, requester: Requester): Promise<void> {
        const review = await this.assertOwnership(id, requester);
        await this.reviewService.softDelete(review.id);
    }

    private async findPublishedProperty(propertyId: string) {
        const property = await this.propertyService.findById(propertyId);
        if (!property || property.status !== ListingStatus.PUBLISHED) {
            throw new NotFoundException('property not found');
        }
        return property;
    }

    private async assertOwnership(id: string, requester: Requester): Promise<Review> {
        const review = await this.reviewService.findById(id);
        if (!review) throw new NotFoundException('review not found');

        if (review.userId !== requester.userId && requester.role !== Role.ADMIN) {
            throw new ForbiddenException('you do not own this review');
        }

        return review;
    }
}
