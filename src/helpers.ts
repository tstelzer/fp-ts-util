import * as t from 'io-ts';
import * as E from 'fp-ts/lib/Either';
import {pipe} from 'fp-ts/lib/function';

export const assertRight = <T>(result: t.Validation<T>, expected?: T) =>
    pipe(
        result,
        E.fold(
            l => {
                throw new TypeError(`${l} is not a right`);
            },
            r => (expected ? expect(r).toStrictEqual(expected) : r),
        ),
    );

export const assertLeft = <T>(result: t.Validation<T>, expected?: T) =>
    pipe(
        result,
        E.fold(
            l => (expected ? expect(l).toStrictEqual(expected) : l),
            r => {
                throw new TypeError(`${r} is not a left`);
            },
        ),
    );

export const assertLeftMatchesSnapshot = <E, A>(result: E.Either<E, A>) =>
    pipe(
        result,
        E.fold(
            l => expect(l).toMatchSnapshot(),
            r => {
                throw new TypeError(`${r} is not a left`);
            },
        ),
    );
