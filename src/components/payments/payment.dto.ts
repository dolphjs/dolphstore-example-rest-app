import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class InitiateFeaturePaymentDto {
    @IsInt()
    @Min(1)
    @Max(90)
    durationDays!: number;
}

export class RefundPaymentDto {
    @IsString()
    @MaxLength(500)
    @IsOptional()
    reason?: string;
}

export class PaymentReferenceParamDto {
    @IsString()
    reference!: string;
}

export class PaymentIdParamDto {
    @IsUUID()
    id!: string;
}
