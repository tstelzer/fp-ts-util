import * as t from 'io-ts';

/**
 * Creates a codec from an `enum`.
 *
 * Note: This only works with string enums.
 *
 * @author https://github.com/haysmike
 * @since 0.1.0
 * @experimental
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
