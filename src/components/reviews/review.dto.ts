import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class ReviewIdParamDto {
    @IsUUID()
    id!: string;
}

export class PropertyReviewParamDto {
    @IsUUID()
    propertyId!: string;
}

export class CreateReviewDto {
    @IsInt()
    @Min(1)
    @Max(5)
    rating!: number;

    @IsString()
    @MinLength(1)
    @MaxLength(1000)
    comment!: string;
}

export class UpdateReviewDto {
    @IsInt()
    @Min(1)
    @Max(5)
    @IsOptional()
    rating?: number;

    @IsString()
    @MinLength(1)
    @MaxLength(1000)
    @IsOptional()
    comment?: string;
}
