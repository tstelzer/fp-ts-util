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
    const env = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = {...env};
    });

    afterEach(() => {
        process.env = env;
    });

    const tests = [
        {
            test: 'InterfaceType',
            codec: t.type({FOO: t.union([t.number, NumberFromString])}),
            setEnv: () => {
                process.env.FOO = '0';
            },
            expected: {FOO: 0},
        },
        {
            test: 'PartialType',
            codec: t.partial({FOO: t.union([t.number, NumberFromString])}),
            setEnv: () => undefined,
            expected: {FOO: undefined},
        },
        {
            test: 'IntersectionType: Type + PartialType',
            codec: t.intersection([
                t.type({FOO: t.union([t.number, NumberFromString])}),
                t.partial({BAR: t.union([t.number, NumberFromString])}),
            ]),
            setEnv: () => {
                process.env.FOO = '13';
            },
            expected: {FOO: 13, BAR: undefined},
        },
        {
            // This is just to make sure that the intersection types
            // are commutative
            test: 'IntersectionType: PartialType + Type',
            codec: t.intersection([
                t.partial({FOO: t.union([t.number, NumberFromString])}),
                t.type({BAR: t.union([t.number, NumberFromString])}),
            ]),
            setEnv: () => {
                process.env.BAR = '13';
            },
            expected: {BAR: 13, FOO: undefined},
        },
        {
            test: 'IntersectionType: Type + Type',
            codec: t.intersection([
                t.type({FOO: t.union([t.number, NumberFromString])}),
                t.type({BAR: t.union([t.number, NumberFromString])}),
            ]),
            setEnv: () => {
                process.env.FOO = '24';
                process.env.BAR = '99';
            },
            expected: {FOO: 24, BAR: 99},
        },
        {
            test: 'Nested IntersectionType',
            codec: t.intersection([
                t.type({A: t.union([t.number, NumberFromString])}),
                t.intersection([
                    t.type({B: t.union([t.number, NumberFromString])}),
                    t.intersection([
                        t.type({C: t.union([t.number, NumberFromString])}),
                        t.partial({D: t.union([t.number, NumberFromString])}),
                    ]),
                ]),
            ]),
            setEnv: () => {
                process.env.A = '2';
                process.env.B = '4';
                process.env.C = '6';
            },
            expected: {A: 2, B: 4, C: 6, D: undefined},
        },
        {
            test: 'UnionType',
            codec: t.union([
                t.type({A: t.union([t.number, NumberFromString])}),
                t.type({B: t.union([t.number, NumberFromString])}),
            ]),
            setEnv: () => {
                process.env.B = '100';
            },
            expected: {A: undefined, B: 100},
        },
    ];

    tests.forEach(({test, codec, setEnv, expected}) => {
        it(`parses environment vars into a value via ${test}`, () => {
            setEnv();
            const run = parseEnv(codec);

            assertRight(run(), expected);
        });
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
