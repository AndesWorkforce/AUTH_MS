import { HttpException, HttpStatus } from '@nestjs/common';

import { errorDictionary, Language } from '../i18n';

export class ValidationException extends HttpException {
  constructor(
    message: string,
    errors?: Record<string, string[]>,
    lang: Language = 'en',
  ) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message: errorDictionary.get('VALIDATION_ERROR', lang),
        errors,
        errorCode: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString(),
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
