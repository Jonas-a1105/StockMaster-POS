import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      name: 'StockMasterPro API',
      version: '1.0.0',
      status: 'running',
      docs: '/health',
    };
  }
}
