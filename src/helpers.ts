import * as t from 'io-ts';
import * as E from 'fp-ts/lib/Either';
import {pipe} from 'fp-ts/lib/function';

/** @internal */
export const NS = 'fp-ts-util';

/** @internal */
export const getIsCodec = <io extends t.Any>(tag: string) => (
    codec: t.Any,
): codec is io => (codec as {_tag?: string})._tag === tag;

/** @internal */
export const isInterfaceCodec = getIsCodec<t.InterfaceType<t.Props>>(
    'InterfaceType',
);

/** @internal */
export const isPartialCodec = getIsCodec<t.PartialType<t.Props>>('PartialType');

/** @internal */
export const isIntFromString = (u: string) =>
    Number.isInteger(Number.parseInt(u, 10));

/** @internal */
const format = (v: any) => JSON.stringify(v);

/** @internal */
export const assertRight = <T>(result: t.Validation<T>, expected?: T) =>
    pipe(
        result,
        E.fold(
            l => {
                throw new TypeError(`${format(l)} is not a right`);
            },
            r => (expected ? expect(r).toStrictEqual(expected) : r),
        ),
    );

/** @internal */
export const assertLeft = <T>(result: t.Validation<T>, expected?: T) =>
    pipe(
        result,
        E.fold(
            l => (expected ? expect(l).toStrictEqual(expected) : l),
            r => {
                throw new TypeError(`${format(r)} is not a left`);
            },
        ),
    );

/** @internal */
export const assertLeftMatchesSnapshot = <E, A>(result: E.Either<E, A>) =>
    pipe(
        result,
        E.fold(
            l => expect(l).toMatchSnapshot(),
            r => {
                throw new TypeError(`${format(r)} is not a left`);
            },
        ),
    );
