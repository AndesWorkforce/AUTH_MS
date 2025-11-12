/**
 * Language type for error messages
 */
export type Language = 'en' | 'es';

/**
 * Error message interface with translations
 */
export interface ErrorMessage {
  en: string;
  es: string;
}

/**
 * Error Dictionary class for managing bilingual error messages
 */
export class ErrorDictionary {
  // Validation Errors (400)
  static readonly VALIDATION_ERROR: ErrorMessage = {
    en: 'Validation failed',
    es: 'Falló la validación',
  };
  static readonly FIELD_REQUIRED: ErrorMessage = {
    en: 'Field {{field}} is required',
    es: 'El campo {{field}} es requerido',
  };
  static readonly INVALID_EMAIL: ErrorMessage = {
    en: 'Invalid email format',
    es: 'Formato de correo electrónico inválido',
  };
  static readonly PASSWORD_TOO_SHORT: ErrorMessage = {
    en: 'Password must be at least {{min}} characters',
    es: 'La contraseña debe tener al menos {{min}} caracteres',
  };

  // Authentication Errors (401)
  static readonly INVALID_CREDENTIALS: ErrorMessage = {
    en: 'Invalid credentials',
    es: 'Credenciales inválidas',
  };
  static readonly INVALID_TOKEN: ErrorMessage = {
    en: 'Invalid or expired token',
    es: 'Token inválido o expirado',
  };
  static readonly TOKEN_EXPIRED: ErrorMessage = {
    en: 'Token has expired',
    es: 'El token ha expirado',
  };
  static readonly REFRESH_TOKEN_EXPIRED: ErrorMessage = {
    en: 'Refresh token has expired',
    es: 'El token de actualización ha expirado',
  };
  static readonly UNAUTHORIZED: ErrorMessage = {
    en: 'Unauthorized access',
    es: 'Acceso no autorizado',
  };

  // Not Found Errors (404)
  static readonly USER_NOT_FOUND: ErrorMessage = {
    en: 'User with identifier {{identifier}} not found',
    es: 'Usuario con identificador {{identifier}} no encontrado',
  };
  static readonly CLIENT_NOT_FOUND: ErrorMessage = {
    en: 'Client with identifier {{identifier}} not found',
    es: 'Cliente con identificador {{identifier}} no encontrado',
  };
  static readonly ENTITY_NOT_FOUND: ErrorMessage = {
    en: '{{entity}} with identifier {{identifier}} not found',
    es: '{{entity}} con identificador {{identifier}} no encontrado',
  };

  // Conflict Errors (409)
  static readonly USER_ALREADY_EXISTS: ErrorMessage = {
    en: 'User with {{field}} "{{value}}" already exists',
    es: 'Usuario con {{field}} "{{value}}" ya existe',
  };
  static readonly CLIENT_ALREADY_EXISTS: ErrorMessage = {
    en: 'Client with {{field}} "{{value}}" already exists',
    es: 'Cliente con {{field}} "{{value}}" ya existe',
  };
  static readonly DUPLICATE_ENTITY: ErrorMessage = {
    en: '{{entity}} with {{field}} "{{value}}" already exists',
    es: '{{entity}} con {{field}} "{{value}}" ya existe',
  };

  // Business Logic Errors (422)
  static readonly BUSINESS_ERROR: ErrorMessage = {
    en: 'Business rule violation',
    es: 'Violación de regla de negocio',
  };
  static readonly PASSWORD_REQUIRED: ErrorMessage = {
    en: 'Password is required',
    es: 'La contraseña es requerida',
  };
  static readonly WEAK_PASSWORD: ErrorMessage = {
    en: 'Password does not meet security requirements',
    es: 'La contraseña no cumple con los requisitos de seguridad',
  };

  // RPC/Service Errors (503)
  static readonly USER_SERVICE_UNAVAILABLE: ErrorMessage = {
    en: 'User service is temporarily unavailable',
    es: 'El servicio de usuarios no está disponible temporalmente',
  };
  static readonly RPC_ERROR: ErrorMessage = {
    en: 'Communication error with {{service}} service',
    es: 'Error de comunicación con el servicio {{service}}',
  };
  static readonly RPC_TIMEOUT: ErrorMessage = {
    en: 'Request timeout for {{service}} service',
    es: 'Tiempo de espera agotado para el servicio {{service}}',
  };

  // Internal Server Errors (500)
  static readonly INTERNAL_ERROR: ErrorMessage = {
    en: 'Internal server error',
    es: 'Error interno del servidor',
  };
  static readonly TOKEN_GENERATION_FAILED: ErrorMessage = {
    en: 'Failed to generate authentication token',
    es: 'Error al generar el token de autenticación',
  };
  static readonly ENCRYPTION_ERROR: ErrorMessage = {
    en: 'Encryption operation failed',
    es: 'Operación de encriptación falló',
  };

  /**
   * Get error message by key with optional language and parameters
   * @param key - Error message key
   * @param lang - Language code ('en' or 'es'), defaults to 'en'
   * @param params - Optional parameters to interpolate in the message
   * @returns Translated error message with interpolated parameters
   */
  static get(
    key: string,
    lang: Language = 'en',
    params?: Record<string, string>,
  ): string {
    const errorMessage = (ErrorDictionary as any)[key];

    if (!errorMessage) {
      console.warn(`Error message key "${key}" not found in dictionary`);
      return key;
    }

    let message = errorMessage[lang];

    // Interpolate parameters if provided
    if (params) {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        message = message.replace(
          new RegExp(`\\{\\{${paramKey}\\}\\}`, 'g'),
          paramValue,
        );
      });
    }

    return message;
  }

  /**
   * Check if an error key exists in the dictionary
   * @param key - Error message key to check
   * @returns True if the key exists, false otherwise
   */
  static has(key: string): boolean {
    return (ErrorDictionary as any)[key] !== undefined;
  }

  /**
   * Get all available error message keys
   * @returns Array of all error message keys
   */
  static keys(): string[] {
    return Object.keys(ErrorDictionary).filter(
      (key) => typeof (ErrorDictionary as any)[key] === 'object',
    );
  }

  /**
   * Get error message in both languages
   * @param key - Error message key
   * @param params - Optional parameters to interpolate
   * @returns Object with both English and Spanish translations
   */
  static getBoth(key: string, params?: Record<string, string>): ErrorMessage {
    return {
      en: this.get(key, 'en', params),
      es: this.get(key, 'es', params),
    };
  }
}

export const errorDictionary = ErrorDictionary;
