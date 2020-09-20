import * as t from 'io-ts';
import {NumberFromString} from 'io-ts-types/lib/NumberFromString';
import * as E from 'fp-ts/lib/Either';
import {pipe} from 'fp-ts/lib/function';

import {assertRight, assertLeft, assertLeftMatchesSnapshot} from './helpers';
import {
    excess,
    fromEnum,
    createConstructor,
    createFormatErrors,
    parseEnv,
    parseEnvW,
} from './index';

describe('excess', () => {
    const codec = excess(t.type({foo: t.string}));

    it('decodes inputs with exact properties of the codec', () => {
        const test = {foo: 'a'};

        assertRight(codec.decode(test));
    });

    it('rejects inputs with excess properties', () => {
        const test = {foo: 'a', bar: 'b'};

        assertLeft(codec.decode(test));
    });
});

describe('fromEnum', () => {
    enum Foo {
        A = 'a',
        B = 'b',
    }

    enum Bar {
        C = 'c',
        D = 'd',
    }

    const codec = fromEnum(Foo, 'Foo');

    it('decodes members of an enum', () => {
        [Foo.A, Foo.B, 'a', 'b'].forEach(member => {
            assertRight(codec.decode(member));
        });
    });

    it('rejects values that are not members of an enum', () => {
        [Bar.C, Bar.D, 'c', 'd'].forEach(member => {
            assertLeft(codec.decode(member));
        });
    });
});

describe('createReportError', () => {
    [
        createFormatErrors({format: 'verbose'}),
        createFormatErrors({format: 'one-line'}),
    ].forEach(formatErrors => {
        it('creates a function that transforms ValidationErrors to human readable strings', () => {
            const tests: [t.Any, unknown][] = [
                [t.type({foo: t.string}, 'CodecA'), {bar: 'string'}],
                [
                    t.type(
                        {
                            root: t.type({
                                leaf: t.type({
                                    baz: t.number,
                                }),
                            }),
                        },
                        'CodecB',
                    ),
                    {root: {leaf: {baz: 'string'}}},
                ],
                [t.type({foo: t.array(t.number)}, 'CodecC'), {bar: [42, 30]}],
                [
                    t.type({foo: t.number, bar: t.string}, 'CodecD'),
                    {foo: '42', bar: 99},
                ],
            ];

            tests.forEach(([codec, value]) => {
                assertLeftMatchesSnapshot(
                    pipe(codec.decode(value), E.mapLeft(formatErrors)),
                );
            });
        });
    });
});

describe('createConstructor', () => {
    const f = createConstructor(t.type({foo: t.string}));

    it('parses valid values', () => {
        const test = {foo: 'string'};
        expect(f(test)).toStrictEqual(test);
    });

    it('throws on rejected values', () => {
        const test = {foo: (42 as unknown) as string};
        expect(() => f(test)).toThrow();
    });
});

describe('parseEnv', () => {
    const previousEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = {...previousEnv};
    });

    afterEach(() => {
        process.env = previousEnv;
    });

    it('parses environment vars into a value', () => {
        const codec = t.type({FOO: t.union([t.number, NumberFromString])});
        process.env.FOO = '0';

        const run = parseEnv(codec);

        assertRight(run(), {FOO: 0});
    });

    it('uses default values', () => {
        const codec = t.type({FOO: t.union([t.number, NumberFromString])});

        const run = parseEnv(codec, {FOO: 9});

        assertRight(run(), {FOO: 9});
    });

    it('overwrites default values with parsed values', () => {
        const codec = t.type({FOO: t.union([t.number, NumberFromString])});
        process.env.FOO = '0';

        const run = parseEnv(codec, {FOO: 9});

        assertRight(run(), {FOO: 0});
    });

    it('rejects invalid env values', () => {
        const codec = t.type({FOO: t.union([t.number, NumberFromString])});
        process.env.FOO = 'not a number';

        const run = parseEnv(codec);

        assertLeft(run());
    });
});

describe('parseEnvW', () => {
    const previousEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = {...previousEnv};
    });

    afterEach(() => {
        process.env = previousEnv;
    });

    it('does not type check defaults', () => {
        const codec = t.type({FOO: t.string});

        const run = parseEnvW(codec, {FOO: 0});

        assertLeft(run());
    });
});
