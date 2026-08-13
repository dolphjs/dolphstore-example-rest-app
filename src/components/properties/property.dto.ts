import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { PaginationDto } from '../../shared/dto';
import { ListingStatus, ListingType, PropertyType } from './property.enums';

export class PropertyIdParamDto {
    @IsUUID()
    id!: string;
}

export class PropertyImageIdParamDto extends PropertyIdParamDto {
    @IsUUID()
    imageId!: string;
}

export class CreatePropertyDto {
    @IsString()
    @MinLength(1)
    title!: string;

    @IsString()
    @MinLength(1)
    description!: string;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    price!: number;

    @IsString()
    @IsOptional()
    currency?: string;

    @IsEnum(ListingType)
    listingType!: ListingType;

    @IsEnum(PropertyType)
    propertyType!: PropertyType;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    @IsOptional()
    bedrooms?: number;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    @IsOptional()
    bathrooms?: number;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @IsOptional()
    areaSqm?: number;

    @IsString()
    @MinLength(1)
    address!: string;

    @IsString()
    @MinLength(1)
    city!: string;

    @IsString()
    @MinLength(1)
    state!: string;

    @IsString()
    @IsOptional()
    country?: string;
}

export class UpdatePropertyDto {
    @IsString()
    @MinLength(1)
    @IsOptional()
    title?: string;

    @IsString()
    @MinLength(1)
    @IsOptional()
    description?: string;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @IsOptional()
    price?: number;

    @IsString()
    @IsOptional()
    currency?: string;

    @IsEnum(ListingType)
    @IsOptional()
    listingType?: ListingType;

    @IsEnum(PropertyType)
    @IsOptional()
    propertyType?: PropertyType;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    @IsOptional()
    bedrooms?: number;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    @IsOptional()
    bathrooms?: number;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @IsOptional()
    areaSqm?: number;

    @IsString()
    @MinLength(1)
    @IsOptional()
    address?: string;

    @IsString()
    @MinLength(1)
    @IsOptional()
    city?: string;

    @IsString()
    @MinLength(1)
    @IsOptional()
    state?: string;

    @IsString()
    @IsOptional()
    country?: string;

    @IsEnum(ListingStatus)
    @IsOptional()
    status?: ListingStatus;
}

export class SearchPropertiesDto extends PaginationDto {
    @IsString()
    @IsOptional()
    city?: string;

    @IsString()
    @IsOptional()
    state?: string;

    @IsEnum(ListingType)
    @IsOptional()
    listingType?: ListingType;

    @IsEnum(PropertyType)
    @IsOptional()
    propertyType?: PropertyType;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @IsOptional()
    minPrice?: number;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @IsOptional()
    maxPrice?: number;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    @IsOptional()
    minBedrooms?: number;
}
