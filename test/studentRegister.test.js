// @vitest-environment happy-dom
import { describe, test, expect } from 'vitest';
import { getMasterlistData } from '../src/Compiler-Folder/studentRegister.js';

describe('Return an Array of Object With Student Name', ()=>{
    const value = getMasterlistData();
    
    test('Return an Array of Objects', ()=>{
        expect(Array.isArray(value)).toBe(true);
    })

    test('getMasterListData Initially Has An Empty Array', ()=>{
        expect(value).toHaveLength(0);
        expect(value).toEqual([]);
    })
})