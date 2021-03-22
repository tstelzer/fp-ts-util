import {identity, pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/lib/Either';
import * as t from 'io-ts';

import {isIntFromString} from './helpers';

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

export type FormatErrorOptions = {
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
