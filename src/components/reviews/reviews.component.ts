import { Component } from '@dolphjs/dolph';
import { PropertyService } from '../properties/property.service';
import { ReviewService } from './review.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Component({
    controllers: [ReviewsController],
    services: [ReviewsService, ReviewService, PropertyService],
})
export class ReviewsComponent {}
