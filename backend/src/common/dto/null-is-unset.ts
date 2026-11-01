import { Transform } from 'class-transformer';

/**
 * For optional fields whose column cannot be null (sort order, on/off switches, status, country): an admin form
 * that clears the input sends null, which means "leave it as it is" — not a database error (it used to be a 500).
 */
export const NullIsUnset = () => Transform(({ value }: { value: unknown }) => (value === null ? undefined : value));
