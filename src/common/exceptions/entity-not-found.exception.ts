import { HttpException, HttpStatus } from '@nestjs/common';

export class EntityNotFoundException extends HttpException {
  constructor(entity: string, identifier: string) {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        message: `${entity} with identifier '${identifier}' not found`,
        errorCode: 'ENTITY_NOT_FOUND',
        timestamp: new Date().toISOString(),
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
