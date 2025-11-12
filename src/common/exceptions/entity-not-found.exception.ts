import { HttpException, HttpStatus } from '@nestjs/common';

import { errorDictionary, Language } from '../i18n';

export class EntityNotFoundException extends HttpException {
  constructor(entity: string, identifier: string, lang: Language = 'en') {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        message: errorDictionary.get('ENTITY_NOT_FOUND', lang, {
          entity,
          identifier,
        }),
        errorCode: 'ENTITY_NOT_FOUND',
        entity,
        identifier,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
