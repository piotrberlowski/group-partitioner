// Test setup file
// Add any global test configuration here

// Increase timeout for complex algorithms
jest.setTimeout(30000);

// Mock console methods for cleaner test output
global.console = {
    ...console,
    // Uncomment to suppress console output during tests
    // log: jest.fn(),
    // warn: jest.fn(),
    // error: jest.fn(),
};
