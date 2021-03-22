import {pipe} from 'fp-ts/function';
import * as IOE from 'fp-ts/IOEither';
import * as t from 'io-ts';

import {isInterfaceCodec, isPartialCodec, NS} from './helpers';

/**
 * Nested IntersectionType.
 */
export type IntersectionType<A> = t.IntersectionType<
    (
        | t.InterfaceType<A>
        | t.PartialType<A>
        | IntersectionType<A>
        | UnionType<A>
    )[]
>;

/**
 * Nested UnionType.
 */
export type UnionType<A> = t.UnionType<
    (
        | t.InterfaceType<A>
        | t.PartialType<A>
        | IntersectionType<A>
        | UnionType<A>
    )[]
>;

/** @internal */
const isInterSectionCodec = <A>(c: t.Any): c is IntersectionType<A> =>
    ((c as unknown) as {_tag: string})._tag === 'IntersectionType';

/** @internal */
const isUnionCodec = <A>(c: t.Any): c is UnionType<A> =>
    ((c as unknown) as {_tag: string})._tag === 'UnionType';

/** @internal */
const getRecordFromEnv = <A>(
    codec: t.Type<A>,
    env: Record<string, unknown>,
): Record<string, unknown> => {
    const _reduceProps = <A>(
        env: Record<string, unknown>,
        codec: t.PartialType<A> | t.InterfaceType<A>,
    ) =>
        Object.keys(codec.props).reduce<Record<string, unknown>>(
            (result, key) => {
                result[key] = env[key];
                return result;
            },
            {},
        );

    if (isInterfaceCodec(codec) || isPartialCodec(codec)) {
        return _reduceProps(env, codec);
    }

    if (isInterSectionCodec<A>(codec) || isUnionCodec<A>(codec)) {
        return codec.types
            .map(innerCodec => getRecordFromEnv(innerCodec, env))
            .reduce<Record<string, unknown>>((m, a) => ({...m, ...a}), {});
    }

    // This shouldn't be thrown, as this function should only be called in a
    // context where the codec is one of the allowed types.
    throw new TypeError(
        `${NS}.parseEnv: codec must be InterfaceType, UnionType, InterfaceType, or PartialType`,
    );
};

/**
 * Takes a codec and returns an IO resolving to a parsed configuration from
 * environment variables, stripping any excess properties on the env value.
 * Optionally, takes default values as second argument.
 *
 * @remarks For now, only accepts codecs that are a combination of
 * t.PartialType, t.InterfaceType, t.UnionType and t.IntersectionType.
 *
 * @since 0.1.0
 * @example
 * const createConfig = parseEnv(t.type({FOO: t.string}, 'Config'));
 *
 * // Assuming a set env var `FOO` of value `"string"`.
 * pipe(
 *     createConfig(),
 *     E.fold(reportErrors, m => JSON.stringify(m)),
 *     console.log, // {"FOO": "string"}
 * );
 */
export const parseEnv = <
    A extends t.Props,
    C extends
        | t.InterfaceType<A>
        | t.PartialType<A>
        | IntersectionType<A>
        | t.UnionType<(t.InterfaceType<A> | t.PartialType<A>)[]>
>(
    codec: C,
    defaults?: Record<string, unknown>,
): IOE.IOEither<t.Errors, t.TypeOf<C>> => () =>
    pipe(
        process.env,
        env => (defaults ? {...defaults, ...env} : env),
        env => getRecordFromEnv(codec, env),
        codec.decode,
    );

/**
 * Weak version of `parseEnv` that doesn't type check `defaults`. Useful when
 * defining defaults outside of TypeScript, i.e. in JSON.
 *
 * @deprecated {@link parseEnv} now defines defaults as unknown.
 * @since 0.1.0
 */
export const parseEnvW = <
    P extends t.Props,
    C extends t.InterfaceType<P>,
    O extends t.TypeOf<C>
>(
    codec: C,
    defaults?: Record<string, unknown>,
): IOE.IOEither<t.Errors, O> => () =>
    pipe(
        process.env,
        m => (defaults ? {...defaults, ...m} : m),
        m =>
            Object.keys(codec.props).reduce<Record<string, unknown>>(
                (result, key) => {
                    result[key] = m[key];
                    return result;
                },
                {},
            ),
        codec.decode,
    );
