import { Component } from '@dolphjs/dolph/decorators';
import { ImageStorageService } from '../../shared/storage';
import { ReviewService } from '../reviews/review.service';
import { PropertyImageService } from './property-image.service';
import { PropertyService } from './property.service';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';

@Component({
    controllers: [PropertiesController],
    services: [PropertiesService, PropertyService, PropertyImageService, ImageStorageService, ReviewService],
})
export class PropertiesComponent {}
