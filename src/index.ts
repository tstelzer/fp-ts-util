import {identity, pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/lib/Either';
import * as t from 'io-ts';
import * as IOE from 'fp-ts/lib/IOEither';

/** @internal */
const NS = 'fp-ts-util';

/** @internal */
const getIsCodec = <io extends t.Any>(tag: string) => (
    codec: t.Any,
): codec is io => (codec as {_tag?: string})._tag === tag;

/** @internal */
const isInterfaceCodec = getIsCodec<t.InterfaceType<t.Props>>('InterfaceType');

/** @internal */
const isPartialCodec = getIsCodec<t.PartialType<t.Props>>('PartialType');

/** @internal */
const isIntFromString = (u: string) => Number.isInteger(Number.parseInt(u, 10));

/**
 * Creates a codec from an `enum`.
 *
 * Note: This only works with string enums.
 *
 * Original author https://github.com/haysmike
 *
 * @since 0.1.0
 * @see https://github.com/gcanti/io-ts/issues/216#issuecomment-621588750
 */
export function fromEnum<T extends string>(
    value: Record<string, T>,
    name: string,
): t.Type<T, T, unknown> {
    const isEnum = (input: unknown): input is T =>
        Object.values<unknown>(value).includes(input);

    return new t.Type<T>(
        name,
        isEnum,
        (input, context) =>
            isEnum(input) ? t.success(input) : t.failure(input, context),
        t.identity,
    );
}

/** @internal */
const formatPath = (error: t.ValidationError) => {
    // Not sure if its just the case that new versions of io-ts don't define
    // _tag on the context, or if this has always been a private field.
    type LegacyType = t.Decoder<any, any> & {
        _tag:
            | 'UnionType'
            | 'IntersectionType'
            | 'InterfaceType'
            | 'PartialType';
    };

    return error.context.reduce((m, node, i) => {
        const parent: t.ContextEntry | undefined = error.context[i - 1];
        if (
            !node.key.length ||
            // Don't render key of union or intersection, because they will
            // print numerical indices, which don't make much sense to the user
            // in this context. Users can just look at the root typee and see
            // the combinations.
            (isIntFromString(node.key) &&
                parent &&
                ['UnionType', 'IntersectionType'].includes(
                    (parent.type as LegacyType)._tag,
                ))
        ) {
            return m;
        }
        return m + `.${node.key}`;
    }, '');
};

/**
 * Takes a validation error and returns a human readable string.
 *
 * @internal
 * @since 0.4.0
 */
const formatErrorOneLine = (error: t.ValidationError): string => {
    const path = formatPath(error);

    const {
        // the incorrect value
        actual: valueAtPath,
        // the type of the incorrect value at `path`
        type: {name},
        // the last item is the "deepest" context, where we get the actual
        // incorrect value
    } = error.context[error.context.length - 1];

    const formatErrorValue = (value: unknown) => {
        switch (typeof value) {
            case 'object':
                return JSON.stringify(value, null).replace(/"/g, "'");
            case 'string':
                return `'${value}'`;
            default:
                return `${value}`;
        }
    };

    const {
        // the actual value we got
        actual: fullValue,
        // the name of the type of the entire object
        type: {name: valueType},
        // the first item is the "full" context
    } = error.context[0];
    return (
        `Unexpected value for type '${valueType}'.` +
        ` Expected type '${name}' at '${path}'` +
        ` but got '${formatErrorValue(valueAtPath)}'.` +
        ` Full value: '${formatErrorValue(fullValue)}'`
    );
};

/** @internal */
const formatErrorVerbose = (error: t.ValidationError): string => {
    const path = formatPath(error);
    const {
        // the incorrect value
        actual: valueAtPath,
        // the type of the incorrect value at `path`
        type: {name},
        // the last item is the "deepest" context, where we get the actual
        // incorrect value
    } = error.context[error.context.length - 1];

    const {
        // the actual value we got
        actual: fullValue,
        // the name of the type of the entire object
        type: {name: valueType},
        // the first item is the "full" context
    } = error.context[0];

    /**
     * @internal
     */
    const formatErrorValue = (value: unknown) => {
        switch (typeof value) {
            case 'object':
                return JSON.stringify(value, null, 4)
                    .split('\n')
                    .reduce((xs, s) => xs + `\t${s}\n`, '')
                    .replace(/"/g, "'");
            case 'string':
                return `\t'${value}'\n`;
            default:
                return `\t${value}\n`;
        }
    };

    if (path) {
        return (
            `Unexpected value for type\n` +
            `\t${valueType}\n` +
            'Expected type\n' +
            `\t${name}\n` +
            `at path\n` +
            `\t${path}\n` +
            'but got\n' +
            formatErrorValue(valueAtPath) +
            'in value\n' +
            formatErrorValue(fullValue)
        );
    } else {
        // When we have no path, we just show the messages.
        return (
            `Unexpected value for type '${valueType}'.\n\n` +
            'With mesages\n\n' +
            `\t"${error.message}"\n\n` +
            'in value\n\n' +
            formatErrorValue(fullValue)
        );
    }
};

/**
 * Takes a validation error and returns a human readable string.
 * Useful for printing the failures directly to a console.
 *
 * @deprecated Use `createReportError` or `createFormatErrors` instead.
 * @since 0.1.0
 */
export const reportError = formatErrorVerbose;

type FormatErrorOptions = {
    format: 'verbose' | 'one-line';
};

/**
 * Creates a function that takes a validation error and returns a human
 * readable string. Can be defined in different formatting styles.
 *
 * @since 0.4.0
 */
export const createFormatError = (options: FormatErrorOptions) => (
    error: t.ValidationError,
): string =>
    options.format === 'verbose'
        ? formatErrorVerbose(error)
        : formatErrorOneLine(error);

/**
 * Convenience wrapper around `reportError` for a list of errors.
 *
 * @deprecated Use `createFormatErrors` instead.
 * @since 0.1.0
 */
export const reportErrors = (errors: t.Errors): string =>
    errors.map(formatErrorVerbose).reduce(s => `${s}\n`);

/**
 * Convenience wrapper around `createReportError` for a list of errors.
 *
 * @since 0.4.0
 */
export const createFormatErrors = (options: FormatErrorOptions) => (
    errors: t.Errors,
): string =>
    errors.map(createFormatError(options)).reduce((o, s) => `${o}\n${s}`);

/** @internal */
const getProps = (codec: t.HasProps): t.Props => {
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

/**
 * Creates a codec that fails on additional properties.
 *
 * Original author https://github.com/noe132
 *
 * @see https://github.com/gcanti/io-ts/issues/322
 * @since 0.1.0
 * @example
 * const A = t.type({a: t.string});
 * const B = excess(t.type({a: t.string}));
 *
 * A.decode({a: 'foo', b: 'bar'}) // Right
 * B.decode({a: 'foo', b: 'bar'}) // Left
 */
export const excess = <C extends t.HasProps>(
    codec: C,
    name: string = getExcessTypeName(codec),
): ExcessType<C> => {
    const props: t.Props = getProps(codec);
    return new ExcessType<C>(
        name,
        (u): u is C => E.isRight(stripKeys(u, props)) && codec.is(u),
        (u, c) =>
            pipe(
                t.UnknownRecord.validate(u, c),
                E.chain(() => codec.validate(u, c)),
                E.chain(a =>
                    pipe(
                        stripKeys<C>(a, props),
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
        a => codec.encode((stripKeys(a, props) as E.Right<t.TypeOf<C>>).right),
        codec,
    );
};

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

/**
 * Takes a codec
 * @internal
 */
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

/**
 * Returns a constructor which parses the value into type `A` (essentially acts
 * as `identity`), or throws a `TypeError` otherwise. Useful as a shortcut when
 * parsing values at a boundary and not requiring the `Either`. When the
 * properties are already parsed, use `encode` instead, otherwise use `decode`.
 * Formats the error message via `reportError`.
 *
 * @since 0.2.0
 * @throws TypeError
 * @example
 * const from = createConstructor(t.type({foo: t.string}));
 * const a = from({foo: 'string'}); // {foo: 'string'}
 * const b = from({foo: 42});       // throws TypeError
 */
export const createConstructor = <A extends t.Any, T extends t.TypeOf<A>>(
    codec: A,
) => (value: T): T =>
    pipe(
        codec.decode(value),
        E.fold(l => {
            throw new TypeError(createFormatErrors({format: 'verbose'})(l));
        }, identity),
    );
