import { Logger } from '@nestjs/common';

// 🎯 CONFIGURACIÓN GLOBAL PARA SILENCIAR LOGS DE NESTJS EN TESTS
beforeEach(() => {
  // Mock todos los métodos del Logger de NestJS
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'verbose').mockImplementation(() => {});

  // También silenciar console directamente por si acaso
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  // Restaurar todos los mocks después de cada test
  jest.restoreAllMocks();
});

// Configuración adicional de Jest
jest.setTimeout(10000);

// Mensaje de confirmación (solo una vez)
if (!global.__JEST_SETUP_LOADED__) {
  global.__JEST_SETUP_LOADED__ = true;
}
