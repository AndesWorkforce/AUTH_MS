import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(message: string, statusCode = HttpStatus.BAD_REQUEST) {
    super(
      {
        statusCode,
        message,
        errorCode: 'BUSINESS_RULE_VIOLATION',
        timestamp: new Date().toISOString(),
      },
      statusCode,
    );
  }
}
