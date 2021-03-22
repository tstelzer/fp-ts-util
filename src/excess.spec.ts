import * as t from 'io-ts';

import {assertRight, assertLeft} from './helpers';
import {excess} from './excess';

type Case = {
    tests: Record<string, unknown>[];
    codec: t.Any;
    name: string;
};

const positive: Case[] = [
    {tests: [{foo: 'a'}], codec: t.type({foo: t.string}), name: 'type'},
    {
        tests: [{foo: 'a'}],
        codec: t.partial({foo: t.string, bar: t.string}),
        name: 'partial',
    },
    {
        tests: [
            {foo: 'a', bar: 'b', a: 'test'},
            {foo: 'a', bar: 'b', b: 0},
        ],
        codec: t.intersection([
            t.type({foo: t.string}),
            t.type({bar: t.string}),
            t.union([t.type({a: t.string}), t.partial({b: t.number})]),
        ]),
        name: 'intersection',
    },
    {
        tests: [
            {},
            {bar: 0},
            {foo: 'test'},
            {a: 'test'},
            {b: 0},
            {x: 'test', y: 0},
        ],
        codec: t.union([
            t.partial({bar: t.number}),
            t.type({foo: t.string}),
            t.union([t.type({a: t.string}), t.partial({b: t.number})]),
            t.intersection([t.type({x: t.string}), t.partial({y: t.number})]),
        ]),
        name: 'union',
    },
];

const negative: Case[] = [
    {
        tests: [{foo: 'a', bar: 'b'}],
        codec: t.type({foo: t.string}),
        name: 'type',
    },
    {
        tests: [{bar: 'b'}],
        codec: t.partial({foo: t.string}),
        name: 'partial',
    },
    {
        tests: [{foo: 'a', bar: 'b', qox: 'c'}],
        codec: t.intersection([
            t.type({foo: t.string}),
            t.type({bar: t.string}),
        ]),
        name: 'intersection',
    },
    {
        tests: [{foo: 0}, {bar: 'test'}, {a: 'test', b: 'test'}, {b: 'test'}],
        codec: t.union([
            t.partial({bar: t.number}),
            t.type({foo: t.string}),
            t.union([t.type({a: t.string}), t.partial({b: t.number})]),
            t.intersection([t.type({x: t.string}), t.partial({y: t.number})]),
        ]),
        name: 'union',
    },
];

describe('excess', () => {
    positive.forEach(({tests, codec, name}) => {
        it(`decodes inputs with exact properties for ${name}`, () => {
            tests.forEach(test => assertRight(excess(codec).decode(test)));
        });
    });

    const c = excess(
        t.union([t.type({foo: t.string}), t.partial({bar: t.number})]),
    );

    negative.forEach(({tests, codec, name}) => {
        it(`rejects inputs with excess properties for ${name}`, () => {
            tests.forEach(test => assertLeft(excess(codec).decode(test)));
        });
    });
});
