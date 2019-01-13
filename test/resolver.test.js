'use strict';

const nodepath = require('path');
const PathResolver = require('../lib/resolver').default;

it('resolves', () => {
    const resolver = new PathResolver({
        namespaces: {
            a: true,
            b: 'b/subdir',
        },
    });

    const baseFilePath = 'a/index/index.tpl';

    const paths = new Map([
        // ['path/tpl', 'path/tpl'],
        ['./path/tpl', 'a/index/path/tpl'],
        ['../path/tpl', 'a/path/tpl'],
        ['../../path/tpl', 'path/tpl'],
        ['../../../path/tpl', '../path/tpl'],
        // ['/path/tpl', 'path/tpl'],
    ]);

    for (const p of paths) {
        expect(resolver.relativeToBasedir(p[0], baseFilePath, true, {
            isFromDir: false,
        })).toBe(p[1].replace(/[\\/]+/g, nodepath.sep));
    }
});

it('resolves namespaces', () => {
    const resolver = new PathResolver({
        namespaces: {
            a: true,
            b: 'b/subdir',
        },
    });

    const baseFilePath = 'a/index/index.tpl';

    const paths = new Map([
        ['::path/tpl', 'a/path/tpl'],
        ['::./path/tpl', 'a/path/tpl'],
        ['::../path/tpl', 'path/tpl'],
        ['::../../path/tpl', '../path/tpl'],
        ['::../../../path/tpl', '../../path/tpl'],
        ['::/path/tpl', 'a/path/tpl'],

        ['b::path/tpl', 'b/subdir/path/tpl'],
        ['b::./path/tpl', 'b/subdir/path/tpl'],
        ['b::../path/tpl', 'b/path/tpl'],
        ['b::../../path/tpl', 'path/tpl'],
        ['b::../../../path/tpl', '../path/tpl'],
        ['b::/path/tpl', 'b/subdir/path/tpl'],
    ]);

    for (const p of paths) {
        expect(resolver.relativeToBasedir(p[0], baseFilePath, true, {
            isFromDir: false,
        })).toBe(p[1].replace(/[\\/]+/g, nodepath.sep));
    }
});
