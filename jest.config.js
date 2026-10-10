/**
 * Jest solo corre contra la lógica pura de los servicios (por ahora,
 * pedidosEstadoMachine.ts), sin tocar Firebase ni componentes de React
 * Native, así que no hace falta el preset de jest-expo: basta con
 * transpilar TypeScript con ts-jest.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testPathIgnorePatterns: ["/node_modules/", "/.expo/"],
};
