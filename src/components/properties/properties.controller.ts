import { DolphControllerHandler } from '@dolphjs/dolph/classes';
import { BadRequestException, DRequest, Dolph } from '@dolphjs/dolph/common';
import { DBody, DParam, DPayload, DQuery, DReq, Delete, Get, Patch, Post, Route, UseMiddleware } from '@dolphjs/dolph/decorators';
import { useFileUploader } from '@dolphjs/dolph/packages';
import { authShield } from '../iam/iam.shield';
import { Role } from '../../shared/enums';
import { JwtPayload } from '../../shared/interfaces';
import { requireRole } from '../../shared/middlewares';
import { CreatePropertyDto, PropertyIdParamDto, PropertyImageIdParamDto, SearchPropertiesDto, UpdatePropertyDto } from './property.dto';
import { PropertiesService } from './properties.service';

@Route('properties')
export class PropertiesController extends DolphControllerHandler<Dolph> {
    constructor(private propertiesService: PropertiesService) {
        super();
    }

    @Get('')
    async search(@DQuery(SearchPropertiesDto) query: SearchPropertiesDto) {
        return this.propertiesService.search(query);
    }

    @UseMiddleware(requireRole(Role.AGENT, Role.ADMIN))
    @UseMiddleware(authShield)
    @Get('mine')
    async mine(@DPayload() payload: JwtPayload, @DQuery(SearchPropertiesDto) query: SearchPropertiesDto) {
        return this.propertiesService.findMine({ userId: payload.sub, role: payload.info.role }, query);
    }

    @Get(':id')
    async findOne(@DParam(PropertyIdParamDto) params: PropertyIdParamDto) {
        return this.propertiesService.findPublished(params.id);
    }

    @UseMiddleware(requireRole(Role.AGENT, Role.ADMIN))
    @UseMiddleware(authShield)
    @Post('')
    async create(@DPayload() payload: JwtPayload, @DBody(CreatePropertyDto) body: CreatePropertyDto) {
        return this.propertiesService.create(payload.sub, body);
    }

    @UseMiddleware(requireRole(Role.AGENT, Role.ADMIN))
    @UseMiddleware(authShield)
    @Patch(':id')
    async update(
        @DParam(PropertyIdParamDto) params: PropertyIdParamDto,
        @DPayload() payload: JwtPayload,
        @DBody(UpdatePropertyDto) body: UpdatePropertyDto,
    ) {
        return this.propertiesService.update(params.id, { userId: payload.sub, role: payload.info.role }, body);
    }

    @UseMiddleware(requireRole(Role.AGENT, Role.ADMIN))
    @UseMiddleware(authShield)
    @Delete(':id')
    async remove(@DParam(PropertyIdParamDto) params: PropertyIdParamDto, @DPayload() payload: JwtPayload) {
        await this.propertiesService.remove(params.id, { userId: payload.sub, role: payload.info.role });
        return { message: 'property removed' };
    }

    @UseMiddleware(useFileUploader({ type: 'single', fieldname: 'image' }))
    @UseMiddleware(requireRole(Role.AGENT, Role.ADMIN))
    @UseMiddleware(authShield)
    @Post(':id/images')
    async addImage(@DParam(PropertyIdParamDto) params: PropertyIdParamDto, @DPayload() payload: JwtPayload, @DReq() req: DRequest) {
        const buffer = req.file?.buffer;
        if (!buffer) throw new BadRequestException('an "image" file is required');

        return this.propertiesService.addImage(params.id, { userId: payload.sub, role: payload.info.role }, buffer);
    }

    @UseMiddleware(requireRole(Role.AGENT, Role.ADMIN))
    @UseMiddleware(authShield)
    @Delete(':id/images/:imageId')
    async removeImage(@DParam(PropertyImageIdParamDto) params: PropertyImageIdParamDto, @DPayload() payload: JwtPayload) {
        await this.propertiesService.removeImage(params.id, params.imageId, { userId: payload.sub, role: payload.info.role });
        return { message: 'image removed' };
    }
}
