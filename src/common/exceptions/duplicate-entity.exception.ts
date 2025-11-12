import { HttpException, HttpStatus } from '@nestjs/common';

export class DuplicateEntityException extends HttpException {
  constructor(entity: string, field: string, value: string) {
    super(
      {
        statusCode: HttpStatus.CONFLICT,
        message: `A ${entity} with ${field} '${value}' already exists`,
        errorCode: 'DUPLICATE_ENTITY',
        timestamp: new Date().toISOString(),
      },
      HttpStatus.CONFLICT,
    );
  }
}
