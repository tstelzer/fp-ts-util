export {excess, ExcessType} from './excess';
export {fromEnum} from './from-enum';
export {
    createFormatError,
    createFormatErrors,
    FormatErrorOptions,
    reportErrors,
    reportError,
    createConstructor,
} from './format-error';
export {parseEnv, parseEnvW} from './parse-env';

/**
 * Utility asserting that _ extends T, representing T.
 *
 * Useful for comparing two types, e.g. the return type of an io-ts codec and
 * some interface.
 *
 * @author https://github.com/gillchristian
 * @since 0.4.10
 *
 * @example simple example
 * type A = string
 * type B = Equals<A, string>
 *
 * @example with io-ts
 * const Codec = io.string;
 * type A = Equals<string, io.TypeOf<typeof Codec>>;
 */
export type Equals<T, _ extends T> = T;
