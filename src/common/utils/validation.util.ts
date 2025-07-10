/**
 * Common validation utilities for configuration files
 */

/**
 * Validates that a port string is a valid port number
 * @param port - The port string to validate
 * @param paramName - The name of the parameter being validated (for error messages)
 * @returns The parsed port number
 * @throws Error if the port is invalid
 */
export function validatePort(port: string, paramName: string = 'PORT'): number {
  const portNum = parseInt(port, 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    throw new Error(
      `Invalid ${paramName}: ${port}. Must be a number between 1 and 65535.`,
    );
  }
  return portNum;
}
