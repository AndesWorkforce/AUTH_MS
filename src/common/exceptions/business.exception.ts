import { HttpException, HttpStatus } from '@nestjs/common';

import { errorDictionary, Language } from '../i18n';

export class BusinessException extends HttpException {
  constructor(
    message: string,
    statusCode = HttpStatus.BAD_REQUEST,
    lang: Language = 'en',
  ) {
    super(
      {
        statusCode,
        message: errorDictionary.get('BUSINESS_ERROR', lang),
        errorCode: 'BUSINESS_RULE_VIOLATION',
        timestamp: new Date().toISOString(),
      },
      statusCode,
    );
  }
}
