// @vitest-environment happy-dom
import { describe, test, expect } from 'vitest';
import {
  getPresentStudents,
  getOcrRawText
} from '../src/Algorithm-Folder/processImage.js';

describe('processImage.js initial state', () => {
  test('Attendance data is stored in an array', () => {
    expect(Array.isArray(getPresentStudents())).toBe(true);
  });

  test('Attendance starts empty', () => {
    expect(getPresentStudents()).toEqual([]);
  });

  test('OCR text is initially undefined', () => {
    expect(getOcrRawText()).toBeUndefined();
  });
});