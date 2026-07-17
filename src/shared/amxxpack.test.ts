import { describe, expect, it } from 'vitest';
import {
    collectAmxxpackIncludePaths,
    parseAmxxpackConfig,
    type AmxxpackConfig,
} from './amxxpack.js';

describe('parseAmxxpackConfig', () => {
    it('parses a minimal config', () => {
        expect(parseAmxxpackConfig('{"include":["./inc"]}')).toEqual({ include: ['./inc'] });
    });

    it('returns undefined for invalid JSON', () => {
        expect(parseAmxxpackConfig('not json')).toBeUndefined();
        expect(parseAmxxpackConfig('')).toBeUndefined();
    });

    it('returns undefined for non-object JSON', () => {
        expect(parseAmxxpackConfig('[]')).toBeUndefined();
        expect(parseAmxxpackConfig('42')).toBeUndefined();
        expect(parseAmxxpackConfig('null')).toBeUndefined();
    });
});

describe('collectAmxxpackIncludePaths', () => {
    const root = '/proj';

    it('collects paths from include[] array', () => {
        const cfg: AmxxpackConfig = { include: ['./inc1', './inc2'] };
        expect(collectAmxxpackIncludePaths(cfg, root)).toEqual(['/proj/inc1', '/proj/inc2']);
    });

    it('collects a string input.include', () => {
        const cfg: AmxxpackConfig = { input: { include: './src/include' } };
        expect(collectAmxxpackIncludePaths(cfg, root)).toEqual(['/proj/src/include']);
    });

    it('collects an object input.include with dir', () => {
        const cfg: AmxxpackConfig = { input: { include: { dir: './src/include' } } };
        expect(collectAmxxpackIncludePaths(cfg, root)).toEqual(['/proj/src/include']);
    });

    it('collects an array of mixed shapes for input.include', () => {
        const cfg: AmxxpackConfig = {
            input: {
                include: ['./src/include', { dir: './extra' }],
            },
        };
        expect(collectAmxxpackIncludePaths(cfg, root)).toEqual(['/proj/src/include', '/proj/extra']);
    });

    it('places input.include before include[]', () => {
        const cfg: AmxxpackConfig = {
            include: ['./third'],
            input: { include: './mine' },
        };
        expect(collectAmxxpackIncludePaths(cfg, root)).toEqual(['/proj/mine', '/proj/third']);
    });

    it('preserves absolute paths as-is', () => {
        const cfg: AmxxpackConfig = { include: ['/absolute/path'] };
        expect(collectAmxxpackIncludePaths(cfg, root)).toEqual(['/absolute/path']);
    });

    it('de-duplicates equivalent paths', () => {
        const cfg: AmxxpackConfig = {
            include: ['./inc', './inc/', './inc'],
            input: { include: './inc' },
        };
        expect(collectAmxxpackIncludePaths(cfg, root)).toEqual(['/proj/inc']);
    });

    it('handles missing include and input entirely', () => {
        expect(collectAmxxpackIncludePaths({}, root)).toEqual([]);
    });

    it('ignores empty-string entries', () => {
        const cfg: AmxxpackConfig = { include: ['', './inc'] };
        expect(collectAmxxpackIncludePaths(cfg, root)).toEqual(['/proj/inc']);
    });

    it('handles the real cs-zombie-panic fixture', () => {
        const cfg: AmxxpackConfig = {
            include: [
                './.compiler/include',
                './.thirdparty/reapi/addons/amxmodx/scripting/include',
            ],
            input: { include: './src/include' },
        };
        expect(collectAmxxpackIncludePaths(cfg, root)).toEqual([
            '/proj/src/include',
            '/proj/.compiler/include',
            '/proj/.thirdparty/reapi/addons/amxmodx/scripting/include',
        ]);
    });
});
