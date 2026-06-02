import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @SkipThrottle()
  getHello() {
    return {
      name: 'StockMasterPro API',
      version: '1.0.0',
      status: 'running',
      docs: '/health',
    };
  }
}
