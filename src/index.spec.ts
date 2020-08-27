import * as t from 'io-ts';
import * as E from 'fp-ts/lib/Either';
import {pipe} from 'fp-ts/lib/function';

import {assertRight, assertLeft, assertLeftMatchesSnapshot} from './helpers';
import {
    excess,
    fromEnum,
    reportErrors,
    withConstructor,
    createConstructor,
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

describe('reportError', () => {
    it('transforms ValidationErrors to human readable strings', () => {
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
        ];

        tests.forEach(([codec, value]) => {
            assertLeftMatchesSnapshot(
                pipe(codec.decode(value), E.mapLeft(reportErrors)),
            );
        });
    });
});

([
    ['createConstructor', createConstructor(t.type({foo: t.string}))],
    ['withConstructor', withConstructor(t.type({foo: t.string})).from],
] as [string, <A>(a: A) => A][]).forEach(([s, f]) => {
    describe(s, () => {
        it('parses valid values', () => {
            const test = {foo: 'string'};
            expect(f(test)).toStrictEqual(test);
        });

        it('throws on rejected values', () => {
            const test = {foo: 42};
            expect(() => f(test)).toThrow();
        });
    });
});
