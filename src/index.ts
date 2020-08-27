import {identity, pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/lib/Either';
import * as t from 'io-ts';
import * as IOE from 'fp-ts/lib/IOEither';

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

/**
 * Takes a validation error and returns a human readable string.
 *
 * @since 0.1.0
 */
export const reportError = (error: t.ValidationError): string => {
    // the path to the incorrect value
    const path = error.context.map(({key}) => key).join('.');

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

    // format actual value and prefix with tabs
    const format = (value: unknown) => {
        switch (typeof value) {
            case 'object':
                return JSON.stringify(value, null, 4)
                    .split('\n')
                    .reduce((xs, s) => xs + `\t${s}\n`, '')
                    .replace(/"/g, "'");
            case 'string':
                return `\t'${value}'\n\n`;
            default:
                return `\t${value}\n\n`;
        }
    };

    if (path) {
        return (
            '-- VALIDATION FAILED --------------------------------------\n\n' +
            `Unexpected value for type '${valueType}'.\n\n` +
            'Expected type\n\n' +
            `\t${name}\n\n` +
            `at path\n\n` +
            `\t${path}\n\n` +
            'but got\n\n' +
            format(valueAtPath) +
            'in value\n\n' +
            format(fullValue) +
            '\n-----------------------------------------------------------\n\n'
        );
    } else {
        // When we have no path, we just show the messages.
        return (
            '-- VALIDATION FAILED --------------------------------------\n\n' +
            `Unexpected value for type '${valueType}'.\n\n` +
            'With mesages\n\n' +
            `\t"${error.message}"\n\n` +
            'in value\n\n' +
            format(fullValue) +
            '\n-----------------------------------------------------------\n\n'
        );
    }
};

/**
 * Convenience wrapper around `reportError` for a list of errors.
 *
 * @since 0.1.0
 */
export const reportErrors = (errors: t.Errors): string =>
    errors.map(reportError).reduce(s => `${s}\n`);

/** @internal */
const getIsCodec = <io extends t.Any>(tag: string) => (
    codec: t.Any,
): codec is io => (codec as any)._tag === tag;

/** @internal */
const isInterfaceCodec = getIsCodec<t.InterfaceType<t.Props>>('InterfaceType');

/** @internal */
const isPartialCodec = getIsCodec<t.PartialType<t.Props>>('PartialType');

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
const stripKeys = <T = any>(
    o: T,
    props: t.Props,
): E.Either<Array<string>, T> => {
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

/** @internal */
class ExcessType<
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
        a => codec.encode((stripKeys(a, props) as E.Right<any>).right),
        codec,
    );
};

/**
 * Takes a codec and returns an IO resolving to a parsed configuration from
 * environment variables. Strips excess properties.
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
export const parseEnv = <A extends t.Props>(
    codec: t.TypeC<A>,
    defaults?: Partial<t.TypeOf<typeof codec>>,
): IOE.IOEither<t.Errors, t.TypeOf<typeof codec>> => () =>
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
 * Weak version of `parseEnv` that doesn't type check `defaults`. Useful when
 * defining defaults outside of TypeScript, i.e. in JSON.
 *
 * @since 0.1.0
 * @see parseEnv
 */
export const parseEnvW = <A extends t.Props>(
    codec: t.TypeC<A>,
    defaults?: Record<string, unknown>,
): IOE.IOEither<t.Errors, t.TypeOf<typeof codec>> => () =>
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
            throw new TypeError(reportErrors(l));
        }, identity),
    );
