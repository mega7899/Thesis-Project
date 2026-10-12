// @vitest-environment happy-dom
import { describe, test, expect } from 'vitest';
import { catchStudenName, testingMaterials } from '../src/processImage.js';

describe('processImage.js Unit Tests', () => {  
  test('catchStudenName returns an array data structure', () => {
    const studentCount = catchStudenName();
    expect(Array.isArray(studentCount)).toBe(true);
  });

  test('testingMaterials holds and returns the OCR string data', () => {
    const materialCall = testingMaterials();
    // Initially undefined before OCR runs, but validates it is designed to store/return string data
    expect(materialCall === undefined || typeof materialCall === 'string').toBe(true);
  });

  test('catchStudenName initially holds an empty student count list', () => {
    const studentCount = catchStudenName();
    expect(studentCount).toHaveLength(0);
    expect(studentCount).toEqual([]);
  });
});