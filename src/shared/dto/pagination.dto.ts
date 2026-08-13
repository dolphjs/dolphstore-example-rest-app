import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @IsOptional()
    page: number = 1;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    @IsOptional()
    limit: number = 20;

    @IsIn(['ASC', 'DESC'])
    @IsOptional()
    order: 'ASC' | 'DESC' = 'DESC';
}
