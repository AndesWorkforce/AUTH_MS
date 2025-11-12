import { HttpException, HttpStatus } from '@nestjs/common';

import { errorDictionary, Language } from '../i18n';

export class DuplicateEntityException extends HttpException {
  constructor(
    entity: string,
    field: string,
    value: string,
    lang: Language = 'en',
  ) {
    super(
      {
        statusCode: HttpStatus.CONFLICT,
        message: errorDictionary.get('DUPLICATE_ENTITY', lang, {
          entity,
          field,
          value,
        }),
        errorCode: 'DUPLICATE_ENTITY',
        entity,
        field,
        value,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.CONFLICT,
    );
  }
}
