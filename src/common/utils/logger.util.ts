import { Logger } from '@nestjs/common';

/**
 * Creates a logger with consistent module-service naming pattern
 * @param serviceClass The service class constructor
 * @param moduleName The module name (e.g., 'EventFetcher', 'Contracts', 'Auth')
 * @returns Logger instance with format '[ModuleName - ServiceName]'
 */
export function createModuleLogger(
  serviceClass: new (...args: any[]) => any,
  moduleName: string,
): Logger {
  // Extract service name and remove 'Service' suffix if present
  const serviceName = serviceClass.name.replace(/Service$/, '');
  return new Logger(`${moduleName} - ${serviceName}`);
}

/**
 * Alternative approach: Create logger from context string
 * @param context The context string (e.g., 'EventListener', 'EventProcessor')
 * @param moduleName The module name (e.g., 'EventFetcher', 'Contracts', 'Auth')
 * @returns Logger instance with format '[ModuleName - Context]'
 */
export function createContextLogger(
  context: string,
  moduleName: string,
): Logger {
  return new Logger(`${moduleName} - ${context}`);
}

/**
 * Creates a logger for controllers with consistent naming
 * @param controllerClass The controller class constructor
 * @param moduleName The module name (e.g., 'EventFetcher', 'Contracts', 'Auth')
 * @returns Logger instance with format '[ModuleName - ControllerName]'
 */
export function createControllerLogger(
  controllerClass: new (...args: any[]) => any,
  moduleName: string,
): Logger {
  // Extract controller name and remove 'Controller' suffix if present
  const controllerName = controllerClass.name.replace(/Controller$/, '');
  return new Logger(`${moduleName} - ${controllerName}`);
}
