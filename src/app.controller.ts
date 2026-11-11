import {
  Controller,
  HttpCode,
  Get,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('App')
@Controller('hello')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOperation({ summary: 'Service health check / hello endpoint' })
  @ApiResponse({ status: 204, description: 'Service health check OK' })
  @Get()
  @HttpCode(204)
  @Header('Cache-Control', 'none')
  getHello(): string {
    return this.appService.getHello();
  }
}
