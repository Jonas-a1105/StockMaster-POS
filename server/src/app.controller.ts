import { Controller, Get, SkipThrottle } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @SkipThrottle()
  getHello(): string {
    return {
      name: 'StockMasterPro API',
      version: '1.0.0',
      status: 'running',
      docs: '/health',
    };
  }
}
