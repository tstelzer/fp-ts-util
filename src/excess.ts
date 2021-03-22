import {pipe} from 'fp-ts/function';
import * as E from 'fp-ts/Either';
import * as t from 'io-ts';

import {
    isInterfaceCodec,
    isUnionType,
    isPartialCodec,
    isHasProps,
} from './helpers';

/**
 * @internal
 * @throws TypeError
 */
const getProps = (codec: t.Any): t.Props => {
    // TODO: refactor
    if (isUnionType(codec)) {
        return codec.types.reduce((r, c) => Object.assign(r, getProps(c)), {});
    } else if (isHasProps(codec)) {
        switch (codec._tag) {
            case 'RefinementType':
            case 'ReadonlyType':
                return getProps(codec.type);
            case 'InterfaceType':
            case 'StrictType':
            case 'PartialType':
                return codec.props;
            case 'IntersectionType':
                return codec.types.reduce<t.Props>(
                    (props, type) => Object.assign(props, getProps(type)),
                    {},
                );
        }
    } else {
        throw new TypeError(
            `Codec "${codec.name}" needs to be of type: HasProps | UnionType.`,
        );
    }
};

/** @internal */
const getNameFromProps = (props: t.Props): string =>
    Object.keys(props)
        .map(k => `${k}: ${props[k].name}`)
        .join(', ');

/** @internal */
const getPartialTypeName = (inner: string): string => `Partial<${inner}>`;

/** @internal */
const getExcessTypeName = (codec: t.Any): string => {
    if (isInterfaceCodec(codec)) {
        return `{| ${getNameFromProps(codec.props)} |}`;
    }
    if (isPartialCodec(codec)) {
        return getPartialTypeName(`{| ${getNameFromProps(codec.props)} |}`);
    }
    return `Excess<${codec.name}>`;
};

/** @internal */
const stripKeys = <T>(o: T, props: t.Props): E.Either<Array<string>, T> => {
    const keys = Object.getOwnPropertyNames(o);
    const propsKeys = Object.getOwnPropertyNames(props);

    propsKeys.forEach(pk => {
        const index = keys.indexOf(pk);
        if (index !== -1) {
            keys.splice(index, 1);
        }
    });

    return keys.length ? E.left(keys) : E.right(o);
};

export class ExcessType<
    C extends t.Any,
    A = C['_A'],
    O = A,
    I = unknown
> extends t.Type<A, O, I> {
    public readonly _tag: 'ExcessType' = 'ExcessType';
    public constructor(
        name: string,
        is: ExcessType<C, A, O, I>['is'],
        validate: ExcessType<C, A, O, I>['validate'],
        encode: ExcessType<C, A, O, I>['encode'],
        public readonly type: C,
    ) {
        super(name, is, validate, encode);
    }
}

function excessProp<T extends t.Any>(
    codec: T,
    name: string = getExcessTypeName(codec),
): ExcessType<T> {
    const props = getProps(codec);
    return new ExcessType<T>(
        name,
        (u): u is T => E.isRight(stripKeys(u, props)) && codec.is(u),
        (u, c) =>
            pipe(
                t.UnknownRecord.validate(u, c),
                E.chain(() => codec.validate(u, c)),
                E.chain(a =>
                    pipe(
                        stripKeys<T>(a, props),
                        E.mapLeft<string[], t.ValidationError[]>(keys =>
                            keys.map(key => ({
                                value: a[key],
                                context: c,
                                message: `excess key "${key}" found`,
                            })),
                        ),
                    ),
                ),
            ),
        a => codec.encode((stripKeys(a, props) as E.Right<t.TypeOf<T>>).right),
        codec,
    );
}

function excessUnion<
    A extends t.Any,
    B extends t.Any,
    C extends t.Any,
    T extends t.UnionType<[A, B, ...C[]]>
>(
    codec: T,
    name: string = getExcessTypeName(codec),
): t.UnionType<[ExcessType<A>, ExcessType<B>, ...ExcessType<C>[]]> {
    // FIXME: Unsure how to avoid this type cast.
    const codecs = codec.types.map(c => excess(c)) as [
        ExcessType<A>,
        ExcessType<B>,
        ...ExcessType<C>[]
    ];

    return t.union(codecs, name);
}

export function excess<
    A extends t.Any,
    B extends t.Any,
    C extends t.Any,
    T extends t.UnionType<[A, B, ...C[]]>
>(
    codec: T,
    name?: string,
): t.UnionType<[ExcessType<A>, ExcessType<B>, ...ExcessType<C>[]]>;

export function excess<T extends t.Any>(codec: T, name?: string): ExcessType<T>;

/**
 * Creates a codec that fails on additional properties.
 *
 * @author https://github.com/noe132
 * @see https://github.com/gcanti/io-ts/issues/322
 * @since 0.1.0
 * @throws TypeError
 * @example
 * const A = t.type({a: t.string});
 * const B = excess(t.type({a: t.string}));
 *
 * A.decode({a: 'foo', b: 'bar'}) // Right
 * B.decode({a: 'foo', b: 'bar'}) // Left
 */
export function excess<
    A extends t.Any,
    B extends t.Any,
    C extends t.Any,
    T extends t.Any | t.UnionType<[A, B, ...C[]]>
>(codec: T, name: string = getExcessTypeName(codec)) {
    if (isUnionType(codec)) {
        return excessUnion(codec, name);
    } else {
        return excessProp(codec, name);
    }
}
