import { DBody, DParam, DPayload, DQuery, Delete, Get, Patch, Post, Route, UseMiddleware } from '@dolphjs/dolph';
import { PaginationDto } from '../../shared/dto';
import { JwtPayload } from '../../shared/interfaces';
import { authShield } from '../iam/iam.shield';
import { CreateReviewDto, PropertyReviewParamDto, ReviewIdParamDto, UpdateReviewDto } from './review.dto';
import { ReviewsService } from './reviews.service';

@Route('')
export class ReviewsController {
    constructor(private reviewsService: ReviewsService) {}

    @Get('properties/:propertyId/reviews')
    async list(@DParam(PropertyReviewParamDto) params: PropertyReviewParamDto, @DQuery(PaginationDto) query: PaginationDto) {
        return this.reviewsService.list(params.propertyId, query);
    }

    @UseMiddleware(authShield)
    @Post('properties/:propertyId/reviews')
    async create(
        @DParam(PropertyReviewParamDto) params: PropertyReviewParamDto,
        @DPayload() payload: JwtPayload,
        @DBody(CreateReviewDto) body: CreateReviewDto,
    ) {
        return this.reviewsService.create(params.propertyId, { userId: payload.sub, role: payload.info.role }, body);
    }

    @UseMiddleware(authShield)
    @Patch('reviews/:id')
    async update(
        @DParam(ReviewIdParamDto) params: ReviewIdParamDto,
        @DPayload() payload: JwtPayload,
        @DBody(UpdateReviewDto) body: UpdateReviewDto,
    ) {
        return this.reviewsService.update(params.id, { userId: payload.sub, role: payload.info.role }, body);
    }

    @UseMiddleware(authShield)
    @Delete('reviews/:id')
    async remove(@DParam(ReviewIdParamDto) params: ReviewIdParamDto, @DPayload() payload: JwtPayload) {
        await this.reviewsService.remove(params.id, { userId: payload.sub, role: payload.info.role });
        return { message: 'review removed' };
    }
}
